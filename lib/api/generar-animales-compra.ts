import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystemUserId } from "@/lib/api/granja";
import { ApiError } from "@/lib/api/errors";
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

const HEMBRAS = new Set(["NOVILLA", "VAQUILLA", "TERNERA", "VACA"]);

export type GenerarAnimalesResult = {
  ok: boolean;
  compraId: string;
  created: number;
  skipped: number;
  aretes: string[];
  message?: string;
};

/** Crea la raza "Sin definir" (o la reutiliza) para animales sin raza conocida. */
export async function ensureRazaSinDefinir(
  admin: SupabaseClient,
  granjaId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("razas")
    .select("id")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .or("codigo.eq.SIN-DEF,nombre.ilike.sin definir")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from("razas")
    .insert({
      granja_id: granjaId,
      codigo: "SIN-DEF",
      nombre: "Sin definir",
      descripcion: "Raza pendiente de identificar (alta desde factura de subasta).",
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear la raza 'Sin definir': ${error.message}`);
  return created.id;
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
  if (!cats?.length)
    throw new ApiError("No hay categorías de animales configuradas.", 409);

  const match = cats.find((c) => {
    const min = c.peso_min_kg == null ? -Infinity : Number(c.peso_min_kg);
    const max = c.peso_max_kg == null ? Infinity : Number(c.peso_max_kg);
    return pesoKg >= min && pesoKg <= max;
  });
  if (match) return match.id;

  // Sin rango que calce: usa NOVI si existe, si no la primera.
  return (cats.find((c) => c.codigo === "NOVI") ?? cats[0]).id;
}

function inferSexo(tipo: string): "M" | "H" {
  return HEMBRAS.has(tipo.toUpperCase()) ? "H" : "M";
}

function parseDetalleRef(ref: string | null, lote: string | null): {
  codigo: string;
  tipo: string;
  color: string;
} {
  // arete_referencia típico: "NO0525 TORO NEGRO"
  const parts = (ref ?? "").trim().split(/\s+/);
  const codigo = (lote ?? parts[0] ?? "").replace(/^NO/i, "").trim();
  return {
    codigo,
    tipo: (parts[1] ?? "").toUpperCase(),
    color: (parts[2] ?? "").toUpperCase(),
  };
}

/** Devuelve un arete único (entre activos) a partir de una base; añade sufijo si colisiona. */
async function uniqueArete(
  admin: SupabaseClient,
  granjaId: string,
  base: string,
  reserved: Set<string>
): Promise<string> {
  const clean = (base || "S/C").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || "SC";
  let candidate = clean;
  let n = 1;
  while (true) {
    if (!reserved.has(candidate)) {
      const { data } = await admin
        .from("animales")
        .select("id")
        .eq("granja_id", granjaId)
        .eq("arete", candidate)
        .is("deleted_at", null)
        .maybeSingle();
      if (!data) {
        reserved.add(candidate);
        return candidate;
      }
    }
    n += 1;
    candidate = `${clean}-${n}`.slice(0, 50);
  }
}

/**
 * Planifica corrales para `needed` animales: llena el espacio libre de los
 * corrales activos y, si falta, crea uno nuevo con capacidad suficiente.
 * Devuelve un arreglo de corralId (uno por animal a crear).
 */
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
        capacidad_maxima: Math.max(faltan, 10),
        tipo: "engorda",
      })
      .select("id")
      .single();
    if (eNew) throw new Error(`No se pudo crear corral automático: ${eNew.message}`);
    for (let i = 0; i < faltan; i++) slots.push(nuevo.id as string);
  }

  return slots;
}

/**
 * Genera un registro en `animales` por cada línea de `detalle_compras` de la
 * compra que aún no está vinculada a un animal. Esto alimenta en cascada:
 * inventario, pesajes (peso de ingreso), ocupación de corral, costos e
 * indicadores del dashboard.
 */
export async function generarAnimalesDesdeCompra(
  admin: SupabaseClient,
  granjaId: string,
  compraId: string,
  opts?: { razaId?: string | null; fechaIngreso?: string | null }
): Promise<GenerarAnimalesResult> {
  const { data: compra, error: eCompra } = await admin
    .from("compras_animales")
    .select("id, fecha_compra, granja_id")
    .eq("id", compraId)
    .eq("granja_id", granjaId)
    .maybeSingle();
  if (eCompra) return { ok: false, compraId, created: 0, skipped: 0, aretes: [], message: eCompra.message };
  if (!compra) return { ok: false, compraId, created: 0, skipped: 0, aretes: [], message: "Compra no encontrada." };

  const { data: detalles, error: eDet } = await admin
    .from("detalle_compras")
    .select("id, arete_referencia, lote_subasta, peso_compra_kg, precio_kg, animal_id")
    .eq("compra_id", compraId)
    .is("animal_id", null);
  if (eDet) return { ok: false, compraId, created: 0, skipped: 0, aretes: [], message: eDet.message };

  const pendientes = (detalles ?? []).filter((d) => Number(d.peso_compra_kg) > 0);
  if (pendientes.length === 0) {
    return { ok: true, compraId, created: 0, skipped: 0, aretes: [], message: "Sin líneas pendientes." };
  }

  const razaId = opts?.razaId ?? (await ensureRazaSinDefinir(admin, granjaId));
  const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
  if (!estadoActivo) {
    return { ok: false, compraId, created: 0, skipped: 0, aretes: [], message: "Estado 'activo' no existe." };
  }
  const loteId = await getDefaultLoteId(admin, granjaId);
  const fechaIngreso = (opts?.fechaIngreso ?? compra.fecha_compra ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const systemUser = getSystemUserId();

  const slots = await planCorralSlots(admin, granjaId, pendientes.length);
  const reserved = new Set<string>();
  const aretes: string[] = [];
  let created = 0;

  for (let i = 0; i < pendientes.length; i++) {
    const det = pendientes[i];
    const { codigo, tipo, color } = parseDetalleRef(det.arete_referencia, det.lote_subasta);
    const peso = normalizeWeightKg(Number(det.peso_compra_kg));
    const sexo = inferSexo(tipo);
    const categoriaId = await getCategoriaIdByWeight(admin, granjaId, peso);
    const corralId = slots[i];
    const arete = await uniqueArete(admin, granjaId, codigo, reserved);
    const obs = [tipo, color].filter(Boolean).join(" ") || null;

    const { data: animal, error: eAnimal } = await admin
      .from("animales")
      .insert({
        granja_id: granjaId,
        arete,
        raza_id: razaId,
        sexo,
        fecha_ingreso: fechaIngreso,
        peso_inicial_kg: peso,
        peso_actual_kg: peso,
        categoria_id: categoriaId,
        estado_id: estadoActivo,
        lote_id: loteId,
        corral_id: corralId,
        compra_detalle_id: det.id,
        observaciones: obs,
      })
      .select(ANIMAL_SELECT)
      .single();

    if (eAnimal) {
      // No abortar todo el lote por una línea; se reporta como skipped.
      continue;
    }

    await upsertPesajeAnimal(admin, {
      animalId: animal.id,
      fechaPesaje: fechaIngreso,
      pesoKg: peso,
      tipoPesaje: "ingreso",
      registradoPorId: systemUser,
    });

    await adjustCorralOcupacion(admin, corralId, 1);
    await admin.from("detalle_compras").update({ animal_id: animal.id }).eq("id", det.id);

    const row = normalizeAnimalRow(animal as Record<string, unknown>);
    const snap = snapshotFromAnimalRow(row);
    await registrarHistorialAnimal(admin, {
      granjaId,
      animalId: row.id,
      arete: row.arete,
      accion: "crear",
      resumen: `Alta desde factura de subasta: arete ${row.arete}, ${obs ?? "animal"}, corral ${snap.corral}, ${snap.pesoActualKg} kg, ₡${Number(det.precio_kg)}/kg.`,
      datosNuevos: {
        ...snap,
        precioCompraKg: Number(det.precio_kg),
        tipoAdquisicion: "subasta",
      },
    }).catch(() => {});

    aretes.push(arete);
    created += 1;
  }

  return {
    ok: true,
    compraId,
    created,
    skipped: pendientes.length - created,
    aretes,
  };
}
