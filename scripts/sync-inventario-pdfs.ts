/**
 * Sincroniza inventario de animales con las listas KEEP de los PDFs físicos.
 *
 * - Mueve aretes existentes al corral objetivo
 * - Soft-delete de aretes que no están en ninguna lista KEEP (ajuste interno, no pérdida)
 * - Crea aretes faltantes (raza Sin definir, macho, peso 0) para cuadrar el físico
 * - Recalcula ocupacion_actual de corrales M1–M9
 *
 *   npx tsx --env-file=.env.local scripts/sync-inventario-pdfs.ts
 *   npx tsx --env-file=.env.local scripts/sync-inventario-pdfs.ts --confirm
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WS from "ws";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

const CONFIRM = process.argv.includes("--confirm");
const TARGET_PATH = resolve("scripts/data/inventario-pdf-target.json");

type TargetFile = {
  modulos: Record<string, { nombre: string; keep: string[] }>;
  notas?: string[];
};

function normArete(a: string) {
  return a.trim().toUpperCase();
}

function areteVariants(a: string): string[] {
  const raw = a.trim();
  const noZeros = raw.replace(/^0+/, "") || "0";
  return [
    ...new Set([
      raw,
      noZeros,
      noZeros.padStart(3, "0"),
      noZeros.padStart(4, "0"),
      noZeros.padStart(5, "0"),
      raw.toUpperCase(),
      raw.toLowerCase(),
    ]),
  ];
}

async function ensureRazaSinDefinir(admin: SupabaseClient, granjaId: string) {
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
      descripcion: "Alta por ajuste inventario físico PDF",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

async function getDefaultCategoria(admin: SupabaseClient, granjaId: string) {
  const { data } = await admin
    .from("categorias_animales")
    .select("id, codigo")
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  return (data?.find((c) => c.codigo === "NOVI") ?? data?.[0])?.id ?? null;
}

async function getDefaultLote(admin: SupabaseClient, granjaId: string) {
  const { data } = await admin
    .from("lotes")
    .select("id")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta .env.local");

  const target = JSON.parse(readFileSync(TARGET_PATH, "utf8")) as TargetFile;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: corrales, error: eC } = await admin
    .from("corrales")
    .select("id, codigo, nombre, granja_id, ocupacion_actual, capacidad_maxima")
    .is("deleted_at", null)
    .in("codigo", Object.keys(target.modulos));
  if (eC) throw eC;

  const corralByCodigo = new Map((corrales ?? []).map((c) => [c.codigo, c]));
  const granjaId = corrales?.[0]?.granja_id;
  if (!granjaId) throw new Error("No se encontró granja/corrales M1–M9");

  for (const codigo of Object.keys(target.modulos)) {
    if (!corralByCodigo.has(codigo)) {
      throw new Error(`Corral ${codigo} no existe`);
    }
  }

  const { data: estados } = await admin
    .from("estados_animales")
    .select("id, codigo");
  const estadoActivo = estados?.find((e) => e.codigo === "activo");
  if (!estadoActivo) throw new Error("Estado activo no encontrado");

  // arete objetivo → codigo corral (última asignación gana si hubiera dup en JSON)
  const desired = new Map<string, string>();
  for (const [codigo, mod] of Object.entries(target.modulos)) {
    for (const arete of mod.keep) {
      desired.set(normArete(arete), codigo);
    }
  }

  // Cargar todos los animales no-deleted de la granja
  type Row = {
    id: string;
    arete: string;
    corral_id: string | null;
    estado_id: string | null;
    granja_id: string;
    deleted_at: string | null;
  };
  let animals: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("animales")
      .select("id, arete, corral_id, estado_id, granja_id, deleted_at")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    animals = animals.concat(data);
    if (data.length < 1000) break;
  }

  const corralCodigoById = new Map(
    (corrales ?? []).map((c) => [c.id, c.codigo])
  );

  // Índice por variantes de arete
  const byAreteNorm = new Map<string, Row[]>();
  for (const a of animals) {
    const key = normArete(a.arete);
    if (!byAreteNorm.has(key)) byAreteNorm.set(key, []);
    byAreteNorm.get(key)!.push(a);
  }

  function findAnimal(arete: string): Row | null {
    for (const v of areteVariants(arete)) {
      const hits = byAreteNorm.get(normArete(v));
      if (hits?.length) return hits[0];
    }
    // match sin ceros
    const nz = arete.replace(/^0+/, "") || "0";
    for (const [k, rows] of byAreteNorm) {
      if ((k.replace(/^0+/, "") || "0") === nz.toUpperCase()) return rows[0];
    }
    return null;
  }

  const moves: Array<{ arete: string; from: string; to: string; id: string }> =
    [];
  const creates: Array<{ arete: string; to: string }> = [];
  const softDeletes: Array<{
    arete: string;
    from: string;
    id: string;
    reason: string;
  }> = [];
  const alreadyOk: string[] = [];

  // 1) Asegurar cada KEEP
  for (const [areteKey, codigo] of desired) {
    const canonical =
      target.modulos[codigo].keep.find(
        (k) => normArete(k) === areteKey
      ) ?? areteKey;
    const found = findAnimal(canonical);
    const dest = corralByCodigo.get(codigo)!;
    if (!found) {
      creates.push({ arete: canonical, to: codigo });
      continue;
    }
    const curCodigo = found.corral_id
      ? corralCodigoById.get(found.corral_id) ?? "?"
      : "?";
    if (found.corral_id === dest.id && found.estado_id === estadoActivo.id) {
      alreadyOk.push(`${canonical}@${codigo}`);
      continue;
    }
    moves.push({
      arete: found.arete,
      from: curCodigo,
      to: codigo,
      id: found.id,
    });
  }

  // 2) Soft-delete animales en M1–M9 que no estén en desired
  const managedCorralIds = new Set((corrales ?? []).map((c) => c.id));
  for (const a of animals) {
    if (!a.corral_id || !managedCorralIds.has(a.corral_id)) continue;
    let inDesired = false;
    for (const v of areteVariants(a.arete)) {
      if (desired.has(normArete(v))) {
        inDesired = true;
        break;
      }
    }
    // también por arete sin ceros
    if (!inDesired) {
      const nz = (a.arete.replace(/^0+/, "") || "0").toUpperCase();
      for (const d of desired.keys()) {
        if ((d.replace(/^0+/, "") || "0") === nz) {
          inDesired = true;
          break;
        }
      }
    }
    if (inDesired) continue;
    // si ya está listado para move hacia otro módulo, no borrar
    if (moves.some((m) => m.id === a.id)) continue;
    softDeletes.push({
      arete: a.arete,
      from: corralCodigoById.get(a.corral_id) ?? "?",
      id: a.id,
      reason: "no aparece en listas KEEP de PDFs",
    });
  }

  const report = {
    modo: CONFIRM ? "CONFIRM" : "DRY-RUN",
    resumen: {
      ok: alreadyOk.length,
      mover: moves.length,
      crear: creates.length,
      softDelete: softDeletes.length,
      keepTotal: desired.size,
    },
    notas: target.notas ?? [],
    porModulo: Object.fromEntries(
      Object.entries(target.modulos).map(([codigo, mod]) => [
        codigo,
        {
          nombre: mod.nombre,
          keep: mod.keep.length,
          crear: creates.filter((c) => c.to === codigo).map((c) => c.arete),
          recibir: moves.filter((m) => m.to === codigo),
        },
      ])
    ),
    moves,
    creates,
    softDeletes,
  };

  writeFileSync(
    resolve("scripts/data/inventario-pdf-sync-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`\n=== Sync inventario PDFs (${report.modo}) ===`);
  console.log(JSON.stringify(report.resumen, null, 2));
  console.log("\nCrear:");
  for (const c of creates) console.log(`  + ${c.arete} → ${c.to}`);
  console.log("\nMover:");
  for (const m of moves)
    console.log(`  ~ ${m.arete}: ${m.from} → ${m.to}`);
  console.log("\nSoft-delete:");
  for (const s of softDeletes)
    console.log(`  - ${s.arete} @ ${s.from} (${s.reason})`);

  if (target.notas?.length) {
    console.log("\nNotas:");
    for (const n of target.notas) console.log(`  • ${n}`);
  }

  if (!CONFIRM) {
    console.log(
      "\nDRY-RUN listo. Revisa scripts/data/inventario-pdf-sync-report.json"
    );
    console.log("Ejecuta con --confirm para aplicar.");
    return;
  }

  const razaId = await ensureRazaSinDefinir(admin, granjaId);
  const categoriaId = await getDefaultCategoria(admin, granjaId);
  const loteId = await getDefaultLote(admin, granjaId);
  const hoy = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Asegurar capacidad
  for (const [codigo, mod] of Object.entries(target.modulos)) {
    const c = corralByCodigo.get(codigo)!;
    const need = mod.keep.length;
    if (Number(c.capacidad_maxima ?? 0) < need) {
      await admin
        .from("corrales")
        .update({ capacidad_maxima: need })
        .eq("id", c.id);
      console.log(`  capacidad ${codigo}: ${c.capacidad_maxima} → ${need}`);
    }
  }

  // Soft-deletes
  for (const s of softDeletes) {
    const { error } = await admin
      .from("animales")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", s.id);
    if (error) {
      console.log(`  ✗ delete ${s.arete}: ${error.message}`);
      continue;
    }
    await admin.from("historial_sistema").insert({
      granja_id: granjaId,
      modulo: "animales",
      registro_id: s.id,
      referencia: s.arete,
      accion: "eliminar",
      resumen: `Ajuste PDF inventario: soft-delete ${s.arete} @ ${s.from} — no cuenta como pérdida.`,
      datos_nuevos: { ajusteInterno: true, motivo: "sync PDFs físicos" },
    });
    console.log(`  ✓ soft-delete ${s.arete}`);
  }

  // Moves
  for (const m of moves) {
    const dest = corralByCodigo.get(m.to)!;
    const { error } = await admin
      .from("animales")
      .update({
        corral_id: dest.id,
        estado_id: estadoActivo.id,
        deleted_at: null,
        updated_at: now,
      })
      .eq("id", m.id);
    if (error) {
      console.log(`  ✗ move ${m.arete}: ${error.message}`);
      continue;
    }
    await admin.from("historial_sistema").insert({
      granja_id: granjaId,
      modulo: "animales",
      registro_id: m.id,
      referencia: m.arete,
      accion: "modificar",
      resumen: `Ajuste PDF inventario: ${m.arete} ${m.from} → ${m.to}`,
      datos_nuevos: {
        ajusteInterno: true,
        corralAnterior: m.from,
        corralNuevo: m.to,
      },
    });
    console.log(`  ✓ move ${m.arete}: ${m.from} → ${m.to}`);
  }

  // Creates
  for (const c of creates) {
    const dest = corralByCodigo.get(c.to)!;
    // ¿existe soft-deleted con ese arete? → reactivar
    const { data: deleted } = await admin
      .from("animales")
      .select("id, arete")
      .eq("granja_id", granjaId)
      .in("arete", areteVariants(c.arete))
      .not("deleted_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (deleted) {
      const { error } = await admin
        .from("animales")
        .update({
          deleted_at: null,
          corral_id: dest.id,
          estado_id: estadoActivo.id,
          updated_at: now,
        })
        .eq("id", deleted.id);
      if (error) console.log(`  ✗ reactivate ${c.arete}: ${error.message}`);
      else console.log(`  ✓ reactivate ${c.arete} → ${c.to}`);
      continue;
    }

    const { data: inserted, error } = await admin
      .from("animales")
      .insert({
        granja_id: granjaId,
        arete: c.arete,
        raza_id: razaId,
        sexo: "M",
        fecha_ingreso: hoy,
        peso_inicial_kg: 1,
        peso_actual_kg: 1,
        categoria_id: categoriaId,
        estado_id: estadoActivo.id,
        lote_id: loteId,
        corral_id: dest.id,
        observaciones: "Alta por sync inventario físico (PDF)",
      })
      .select("id")
      .single();
    if (error) {
      console.log(`  ✗ create ${c.arete}: ${error.message}`);
      continue;
    }
    await admin.from("historial_sistema").insert({
      granja_id: granjaId,
      modulo: "animales",
      registro_id: inserted.id,
      referencia: c.arete,
      accion: "crear",
      resumen: `Ajuste PDF inventario: alta ${c.arete} en ${c.to}`,
      datos_nuevos: { ajusteInterno: true, corral: c.to },
    });
    console.log(`  ✓ create ${c.arete} → ${c.to}`);
  }

  // Recalcular ocupación por conteo real de activos
  for (const c of corrales ?? []) {
    const { count } = await admin
      .from("animales")
      .select("id", { count: "exact", head: true })
      .eq("corral_id", c.id)
      .eq("estado_id", estadoActivo.id)
      .is("deleted_at", null);
    await admin
      .from("corrales")
      .update({ ocupacion_actual: count ?? 0 })
      .eq("id", c.id);
    console.log(`  ocupacion ${c.codigo} ${c.nombre} = ${count}`);
  }

  console.log("\nAplicado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
