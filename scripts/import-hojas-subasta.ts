/**
 * Importa hojas de subasta/pesaje (PDF transcrito) al inventario.
 *
 * Reglas:
 *  - Lote 1 Variante 2 omitido (no está en el JSON)
 *  - Sin precio → excluidos (lista en JSON)
 *  - Arete real; si ya existe → solo rellena campos vacíos
 *  - Sexo M; proveedor demo habitual; misma granja
 *
 *   npx tsx scripts/import-hojas-subasta.ts
 *   npx tsx scripts/import-hojas-subasta.ts --dry-run
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = process.cwd();
function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(join(appRoot, ".env.local"));

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, getSystemUserId } from "@/lib/api/granja";
import {
  ensureRazaSinDefinir,
} from "@/lib/api/generar-animales-compra";
import {
  getDefaultLoteId,
  normalizeAnimalRow,
  ANIMAL_SELECT,
} from "@/lib/api/animales-query";
import {
  getEstadoIdByCodigo,
  adjustCorralOcupacion,
  nextCodigoForTipo,
} from "@/lib/api/corrales-helpers";
import { upsertPesajeAnimal, normalizeWeightKg } from "@/lib/api/pesaje-utils";
import {
  registrarHistorialAnimal,
  snapshotFromAnimalRow,
} from "@/lib/api/historial-animal";

const PROVEEDOR_HABITUAL_ID = "11111111-1111-1111-1111-111111111111";
const DATA_PATH = join(appRoot, "scripts/data/hojas-subasta-cleaned.json");
const REPORT_PATH = join(appRoot, "scripts/data/hojas-subasta-import-report.json");

type AnimalRow = {
  lote: string;
  n: number;
  fechaIngreso: string;
  subasta: string;
  arete: string;
  pesoKg: number;
  precioKg: number;
  precioTotal: number;
  fechaSalida: string | null;
  nota?: string;
};

type Dataset = {
  meta: Record<string, unknown>;
  excluidos: Array<{ lote: string; arete: string; motivo: string; nota: string }>;
  animales: AnimalRow[];
};

type ReportLine = {
  arete: string;
  lote: string;
  action: "created" | "updated" | "skipped_dup" | "error" | "excluded";
  detail: string;
};

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

async function resolveProveedorHabitual(
  admin: SupabaseClient,
  granjaId: string
): Promise<string> {
  const { data: demo } = await admin
    .from("proveedores")
    .select("id, razon_social")
    .eq("id", PROVEEDOR_HABITUAL_ID)
    .eq("granja_id", granjaId)
    .maybeSingle();
  if (demo?.id) return demo.id;

  const { data: anyProv } = await admin
    .from("proveedores")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("activo", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (anyProv?.id) return anyProv.id;
  throw new Error("No hay proveedor habitual configurado.");
}

async function getCategoriaIdByWeight(
  admin: SupabaseClient,
  granjaId: string,
  pesoKg: number
): Promise<string> {
  const { data: cats, error } = await admin
    .from("categorias_animales")
    .select("id, codigo, peso_min_kg, peso_max_kg")
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  if (!cats?.length) throw new Error("No hay categorías de animales.");

  const match = cats.find((c) => {
    const min = c.peso_min_kg == null ? -Infinity : Number(c.peso_min_kg);
    const max = c.peso_max_kg == null ? Infinity : Number(c.peso_max_kg);
    return pesoKg >= min && pesoKg <= max;
  });
  return (match ?? cats.find((c) => c.codigo === "NOVI") ?? cats[0]).id;
}

async function planCorralSlots(
  admin: SupabaseClient,
  granjaId: string,
  needed: number
): Promise<string[]> {
  const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
  const { data: corrales, error } = await admin
    .from("corrales")
    .select("id, capacidad_maxima")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("codigo", { ascending: true });
  if (error) throw new Error(error.message);

  const slots: string[] = [];
  for (const c of corrales ?? []) {
    let activos = 0;
    if (estadoActivo) {
      const { count } = await admin
        .from("animales")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .eq("corral_id", c.id)
        .eq("estado_id", estadoActivo)
        .is("deleted_at", null);
      activos = count ?? 0;
    }
    const free = Math.max(0, Number(c.capacidad_maxima) - activos);
    for (let i = 0; i < free && slots.length < needed; i++) slots.push(c.id as string);
    if (slots.length >= needed) break;
  }

  if (slots.length < needed) {
    const faltan = needed - slots.length;
    const codigo = await nextCodigoForTipo(admin, granjaId, "engorda");
    const { data: nuevo, error: eNew } = await admin
      .from("corrales")
      .insert({
        granja_id: granjaId,
        codigo,
        nombre: `Módulo ${codigo}`,
        capacidad_maxima: Math.max(faltan, 50),
        tipo: "engorda",
      })
      .select("id")
      .single();
    if (eNew) throw new Error(`No se pudo crear corral: ${eNew.message}`);
    for (let i = 0; i < faltan; i++) slots.push(nuevo.id as string);
  }
  return slots;
}

function buildObs(row: AnimalRow): string {
  const parts = [
    `Hoja ${row.lote}`,
    row.subasta ? `subasta ${row.subasta}` : null,
    row.fechaSalida ? `salida hoja ${row.fechaSalida}` : null,
    row.nota ?? null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function mergeObs(existing: string | null, incoming: string): string {
  if (!existing?.trim()) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing} | ${incoming}`.slice(0, 500);
}

async function ensureCompraDetalle(
  admin: SupabaseClient,
  params: {
    granjaId: string;
    proveedorId: string;
    compraId: string;
    animalId: string;
    row: AnimalRow;
    dryRun: boolean;
  }
): Promise<string | null> {
  const { animalId, row, compraId, dryRun } = params;
  const peso = normalizeWeightKg(row.pesoKg);
  const subtotal = Math.round(peso * row.precioKg * 100) / 100;

  if (dryRun) return "dry-run-detalle";

  const { data: detalle, error } = await admin
    .from("detalle_compras")
    .insert({
      compra_id: compraId,
      arete_referencia: row.arete,
      peso_compra_kg: peso,
      precio_kg: row.precioKg,
      subtotal,
      lote_subasta: row.lote.slice(0, 50),
      animal_id: animalId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`detalle_compras: ${error.message}`);

  await admin
    .from("animales")
    .update({ compra_detalle_id: detalle.id })
    .eq("id", animalId);

  return detalle.id as string;
}

async function createAnimal(
  admin: SupabaseClient,
  params: {
    granjaId: string;
    proveedorId: string;
    compraId: string;
    razaId: string;
    estadoActivo: string;
    loteId: string | null;
    corralId: string;
    categoriaId: string;
    row: AnimalRow;
    dryRun: boolean;
  }
): Promise<{ id: string; arete: string }> {
  const { granjaId, row, dryRun, corralId, categoriaId } = params;
  const peso = normalizeWeightKg(row.pesoKg);
  const obs = buildObs(row);

  if (dryRun) {
    return { id: "dry-run", arete: row.arete };
  }

  const { data: animal, error } = await admin
    .from("animales")
    .insert({
      granja_id: granjaId,
      arete: row.arete,
      raza_id: params.razaId,
      sexo: "M",
      fecha_ingreso: row.fechaIngreso,
      peso_inicial_kg: peso,
      peso_actual_kg: peso,
      categoria_id: categoriaId,
      estado_id: params.estadoActivo,
      lote_id: params.loteId,
      corral_id: corralId,
      observaciones: obs,
    })
    .select(ANIMAL_SELECT)
    .single();
  if (error) throw new Error(`animales insert ${row.arete}: ${error.message}`);

  await ensureCompraDetalle(admin, {
    granjaId,
    proveedorId: params.proveedorId,
    compraId: params.compraId,
    animalId: animal.id,
    row,
    dryRun,
  });

  await upsertPesajeAnimal(admin, {
    animalId: animal.id,
    fechaPesaje: row.fechaIngreso,
    pesoKg: peso,
    tipoPesaje: "ingreso",
    registradoPorId: getSystemUserId(),
  });

  await adjustCorralOcupacion(admin, corralId, 1);

  const mapped = normalizeAnimalRow(animal as Record<string, unknown>);
  const snap = snapshotFromAnimalRow(mapped);
  await registrarHistorialAnimal(admin, {
    granjaId,
    animalId: mapped.id,
    arete: mapped.arete,
    accion: "crear",
    resumen: `Alta desde hojas de subasta: arete ${mapped.arete}, ${peso} kg, ₡${row.precioKg}/kg, lote ${row.lote}.`,
    datosNuevos: {
      ...snap,
      precioCompraKg: row.precioKg,
      tipoAdquisicion: "subasta",
    },
  }).catch(() => {});

  return { id: animal.id as string, arete: row.arete };
}

async function updateOnlyEmpty(
  admin: SupabaseClient,
  params: {
    granjaId: string;
    proveedorId: string;
    compraId: string;
    existing: Record<string, unknown>;
    row: AnimalRow;
    dryRun: boolean;
  }
): Promise<string[]> {
  const { existing, row, dryRun } = params;
  const peso = normalizeWeightKg(row.pesoKg);
  const patch: Record<string, unknown> = {};
  const filled: string[] = [];

  if (isEmpty(existing.peso_inicial_kg)) {
    patch.peso_inicial_kg = peso;
    filled.push("peso_inicial_kg");
  }
  if (isEmpty(existing.peso_actual_kg)) {
    patch.peso_actual_kg = peso;
    filled.push("peso_actual_kg");
  }
  if (isEmpty(existing.fecha_ingreso)) {
    patch.fecha_ingreso = row.fechaIngreso;
    filled.push("fecha_ingreso");
  }
  if (isEmpty(existing.sexo)) {
    patch.sexo = "M";
    filled.push("sexo");
  }

  const obsIncoming = buildObs(row);
  const obsCurrent = (existing.observaciones as string | null) ?? null;
  const obsMerged = mergeObs(obsCurrent, obsIncoming);
  if (obsMerged !== obsCurrent) {
    patch.observaciones = obsMerged;
    filled.push("observaciones");
  }

  if (!dryRun && Object.keys(patch).length > 0) {
    const { error } = await admin
      .from("animales")
      .update(patch)
      .eq("id", existing.id as string)
      .eq("granja_id", params.granjaId);
    if (error) throw new Error(`update ${row.arete}: ${error.message}`);
  }

  if (isEmpty(existing.compra_detalle_id)) {
    await ensureCompraDetalle(admin, {
      granjaId: params.granjaId,
      proveedorId: params.proveedorId,
      compraId: params.compraId,
      animalId: existing.id as string,
      row,
      dryRun,
    });
    filled.push("compra_detalle_id");
  }

  // Pesaje de ingreso solo si no hay pesajes
  if (!dryRun) {
    const { count } = await admin
      .from("pesajes")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", existing.id as string)
      .is("deleted_at", null);
    if ((count ?? 0) === 0 && !isEmpty(existing.fecha_ingreso ?? row.fechaIngreso)) {
      await upsertPesajeAnimal(admin, {
        animalId: existing.id as string,
        fechaPesaje: (existing.fecha_ingreso as string) || row.fechaIngreso,
        pesoKg: Number(existing.peso_actual_kg ?? existing.peso_inicial_kg ?? peso),
        tipoPesaje: "ingreso",
        registradoPorId: getSystemUserId(),
      });
      filled.push("pesaje_ingreso");
    }
  }

  return filled;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Dataset;

  // Validar peso × precio ≈ total
  const mismatches: string[] = [];
  for (const a of dataset.animales) {
    const calc = Math.round(a.pesoKg * a.precioKg * 100) / 100;
    if (Math.abs(calc - a.precioTotal) > 2) {
      mismatches.push(
        `${a.arete}: ${a.pesoKg}×${a.precioKg}=${calc} vs total ${a.precioTotal}`
      );
    }
  }

  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  const proveedorId = await resolveProveedorHabitual(admin, granjaId);
  const razaId = await ensureRazaSinDefinir(admin, granjaId);
  const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
  if (!estadoActivo) throw new Error("Estado 'activo' no existe.");
  const loteId = await getDefaultLoteId(admin, granjaId);

  const folio = `HOJAS-SUBASTA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const pesoTotal = dataset.animales.reduce((s, a) => s + a.pesoKg, 0);
  const montoTotal = dataset.animales.reduce((s, a) => s + a.precioTotal, 0);

  console.log(`Granja: ${granjaId}`);
  console.log(`Proveedor: ${proveedorId}`);
  console.log(`Modo: ${dryRun ? "DRY-RUN" : "WRITE"}`);
  console.log(`A importar: ${dataset.animales.length}`);
  console.log(`Excluidos: ${dataset.excluidos.length}`);
  console.log(`Mismatches peso×precio: ${mismatches.length}`);
  if (mismatches.length) console.log(mismatches.slice(0, 10).join("\n"));

  let compraId = "dry-run-compra";
  if (!dryRun) {
    const { data: compra, error } = await admin
      .from("compras_animales")
      .insert({
        granja_id: granjaId,
        proveedor_id: proveedorId,
        folio,
        fecha_compra: "2026-06-23",
        tipo_adquisicion: "subasta",
        peso_total_kg: pesoTotal,
        monto_total: montoTotal,
        observaciones:
          "Importación hojas de registro subasta/pesaje (PDF Archivos de Imagen Inválidos). Sin Lote 1 Variante 2. Excluidos sin precio.",
      })
      .select("id")
      .single();
    if (error) throw new Error(`compras_animales: ${error.message}`);
    compraId = compra.id as string;
    console.log(`Compra creada: ${compraId} folio=${folio}`);
  }

  const allAretes = [...new Set(dataset.animales.map((a) => a.arete))];
  const { data: existingRows } = await admin
    .from("animales")
    .select(
      "id,arete,peso_inicial_kg,peso_actual_kg,fecha_ingreso,sexo,observaciones,compra_detalle_id"
    )
    .eq("granja_id", granjaId)
    .in("arete", allAretes)
    .is("deleted_at", null);
  const byArete = new Map(
    (existingRows ?? []).map((r) => [r.arete as string, r as Record<string, unknown>])
  );

  // Primero: cuántos hay que crear (aretes únicos sin existir)
  const toCreate: AnimalRow[] = [];
  const seenPrep = new Set<string>();
  for (const row of dataset.animales) {
    if (seenPrep.has(row.arete)) continue;
    seenPrep.add(row.arete);
    if (!byArete.has(row.arete)) toCreate.push(row);
  }

  const slots = dryRun
    ? toCreate.map(() => "dry-corral")
    : await planCorralSlots(admin, granjaId, toCreate.length);
  let slotIdx = 0;

  const catCache = new Map<number, string>();
  async function catFor(peso: number) {
    const key = Math.round(peso);
    if (!catCache.has(key)) {
      catCache.set(key, await getCategoriaIdByWeight(admin, granjaId, peso));
    }
    return catCache.get(key)!;
  }

  const report: ReportLine[] = [];
  for (const ex of dataset.excluidos) {
    report.push({
      arete: ex.arete,
      lote: ex.lote,
      action: "excluded",
      detail: ex.nota,
    });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seen = new Set<string>();

  for (const row of dataset.animales) {
    const key = row.arete;
    try {
      const existing = byArete.get(key) ?? null;

      if (seen.has(key)) {
        if (existing) {
          const filled = await updateOnlyEmpty(admin, {
            granjaId,
            proveedorId,
            compraId,
            existing,
            row,
            dryRun,
          });
          if (filled.length) {
            updated += 1;
            report.push({
              arete: key,
              lote: row.lote,
              action: "updated",
              detail: `dup en dataset → rellenó: ${filled.join(", ")}`,
            });
          } else {
            skipped += 1;
            report.push({
              arete: key,
              lote: row.lote,
              action: "skipped_dup",
              detail: "Arete ya procesado; sin campos vacíos",
            });
          }
        }
        continue;
      }
      seen.add(key);

      if (existing) {
        const filled = await updateOnlyEmpty(admin, {
          granjaId,
          proveedorId,
          compraId,
          existing,
          row,
          dryRun,
        });
        if (filled.length) {
          updated += 1;
          report.push({
            arete: key,
            lote: row.lote,
            action: "updated",
            detail: `rellenó: ${filled.join(", ")}`,
          });
        } else {
          skipped += 1;
          report.push({
            arete: key,
            lote: row.lote,
            action: "skipped_dup",
            detail: "Ya existía; sin campos vacíos que rellenar",
          });
        }
      } else {
        const corralId = slots[slotIdx++] ?? slots[slots.length - 1];
        const categoriaId = await catFor(row.pesoKg);
        const createdRow = await createAnimal(admin, {
          granjaId,
          proveedorId,
          compraId,
          razaId,
          estadoActivo,
          loteId,
          corralId,
          categoriaId,
          row,
          dryRun,
        });
        byArete.set(key, {
          id: createdRow.id,
          arete: key,
          peso_inicial_kg: row.pesoKg,
          peso_actual_kg: row.pesoKg,
          fecha_ingreso: row.fechaIngreso,
          sexo: "M",
          observaciones: buildObs(row),
          compra_detalle_id: "set",
        });
        created += 1;
        report.push({
          arete: key,
          lote: row.lote,
          action: "created",
          detail: `${row.pesoKg} kg @ ₡${row.precioKg}`,
        });
      }
    } catch (e) {
      errors += 1;
      report.push({
        arete: key,
        lote: row.lote,
        action: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
      console.error(`✗ ${key}:`, e);
    }
  }

  const summary = {
    dryRun,
    granjaId,
    proveedorId,
    compraId,
    folio: dryRun ? null : folio,
    created,
    updated,
    skipped,
    errors,
    excluded: dataset.excluidos.length,
    uniqueAretes: seen.size,
    mismatches,
  };

  writeFileSync(
    REPORT_PATH,
    JSON.stringify({ summary, report }, null, 2),
    "utf8"
  );

  console.log("─".repeat(50));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Reporte: ${REPORT_PATH}`);

  if (!dryRun) {
    const { count } = await admin
      .from("animales")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .is("deleted_at", null);
    console.log(`Total animales en inventario: ${count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
