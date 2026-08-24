/**
 * Baja de inventario:
 * - Arete 36/37 en Ceiba arriba (numeración doble; el animal no existe)
 * - Arete 2242 donado a la iglesia el 9 de agosto de 2026
 *
 * Historial firmado como Sonia Herrera.
 *
 *   npx tsx --env-file=.env.local scripts/baja-36-37-ceiba-y-2242.ts
 *   npx tsx --env-file=.env.local scripts/baja-36-37-ceiba-y-2242.ts --confirm
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WS from "ws";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

const CONFIRM = process.argv.includes("--confirm");
const AUTOR = "Sonia Herrera";

type CorralJoin = { codigo: string | null; nombre: string } | null;
type EstadoJoin = { codigo: string; nombre: string } | null;

type AnimalRow = {
  id: string;
  arete: string;
  granja_id: string;
  corral_id: string | null;
  deleted_at: string | null;
  peso_inicial_kg: number | null;
  peso_actual_kg: number | null;
  fecha_ingreso: string | null;
  observaciones: string | null;
  sexo: string | null;
  corrales: CorralJoin | { codigo: string | null; nombre: string }[];
  estados_animales: EstadoJoin | { codigo: string; nombre: string }[];
  razas: { nombre: string; codigo: string } | { nombre: string; codigo: string }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
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

function isCeibaArriba(nombre: string, codigo?: string | null) {
  const n = norm(nombre);
  const c = norm(codigo ?? "");
  return /ceiba\s*arriba/.test(n) || /ceiba\s*arriba/.test(c) || /^3ceiba/.test(n) || c === "m3";
}

function displayAnimal(a: AnimalRow) {
  const corral = one(a.corrales);
  const estado = one(a.estados_animales);
  return `${a.arete} id=${a.id.slice(0, 8)}… corral=${corral?.nombre ?? "?"} estado=${estado?.codigo ?? "?"} deleted=${!!a.deleted_at}`;
}

const ANIMAL_SELECT = `
  id, arete, granja_id, corral_id, deleted_at,
  peso_inicial_kg, peso_actual_kg, fecha_ingreso, observaciones, sexo,
  corrales ( codigo, nombre ),
  estados_animales ( codigo, nombre ),
  razas ( nombre, codigo )
`;

async function findByAretes(admin: SupabaseClient, aretes: string[]) {
  const variants = [...new Set(aretes.flatMap(areteVariants))];
  const { data, error } = await admin
    .from("animales")
    .select(ANIMAL_SELECT)
    .in("arete", variants);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AnimalRow[];
}

async function findDoble3637Ceiba(admin: SupabaseClient): Promise<AnimalRow[]> {
  const { data, error } = await admin
    .from("animales")
    .select(ANIMAL_SELECT)
    .or("arete.ilike.%3637%ceiba%,arete.ilike.3637ceiba%,arete.eq.36 37,arete.eq.36-37");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as AnimalRow[];
  return rows.filter((a) => {
    const corral = one(a.corrales);
    return isCeibaArriba(corral?.nombre ?? "", corral?.codigo ?? null);
  });
}

async function resolveAutorId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nombre, apellido, email, activo")
    .is("deleted_at", null);
  if (error) {
    console.log(`  ⚠ No se pudo leer usuarios: ${error.message}`);
    return null;
  }
  const hit = (data ?? []).find((u) => {
    const full = `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim().toLowerCase();
    return full === "sonia herrera" || (full.includes("sonia") && full.includes("herrera"));
  });
  if (hit) {
    console.log(`  Autor hallado: ${hit.nombre} ${hit.apellido ?? ""} <${hit.email}> id=${hit.id}`);
    return hit.id;
  }
  console.log("  Sonia Herrera no está en usuarios; el historial llevará su nombre en el resumen.");
  return null;
}

type BajaPlan = {
  animal: AnimalRow;
  referencia: string;
  resumen: string;
  motivo: string;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta .env.local (URL / SERVICE_ROLE_KEY)");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n=== Baja 36/37 Ceiba arriba + 2242 (modo: ${CONFIRM ? "CONFIRM" : "DRY-RUN"}) ===`);
  console.log(`Autor historial: ${AUTOR}\n`);

  const autorId = await resolveAutorId(admin);

  const planes: BajaPlan[] = [];

  // ── 36 37 Ceiba arriba (numeración doble, arete "3637ceiba arriba") ──
  const candidatos3637 = await findDoble3637Ceiba(admin);

  console.log("\n-- Candidatos 36 37 Ceiba arriba (numeración doble) --");
  if (candidatos3637.length === 0) {
    console.log("  Ninguno encontrado.");
  } else {
    for (const a of candidatos3637) console.log(`  ${displayAnimal(a)}`);
  }

  const doblesActivos = candidatos3637.filter((a) => !a.deleted_at);
  for (const doble of doblesActivos) {
    planes.push({
      animal: doble,
      referencia: doble.arete,
      motivo: "numeracion_doble_inexistente",
      resumen: `Baja arete ${doble.arete} (Ceiba arriba): no existe; se mantenía con numeración doble 36 37. Autor: ${AUTOR}.`,
    });
  }
  if (doblesActivos.length === 0 && candidatos3637.some((a) => a.deleted_at)) {
    console.log("  Ya está soft-deleted.");
  }

  // ── 2242 donado a la iglesia ──────────────────────────────────
  const candidatos2242 = await findByAretes(admin, ["2242"]);
  console.log("\n-- Candidatos 2242 --");
  if (candidatos2242.length === 0) {
    console.log("  No encontrado.");
  } else {
    for (const a of candidatos2242) console.log(`  ${displayAnimal(a)}`);
  }

  const activo2242 = candidatos2242.filter((a) => !a.deleted_at);
  if (activo2242.length === 1) {
    const a = activo2242[0];
    const corral = one(a.corrales);
    planes.push({
      animal: a,
      referencia: a.arete,
      motivo: "donado_iglesia",
      resumen: `Baja arete ${a.arete} (${corral?.nombre ?? "sin corral"}): salió donado a la iglesia el 9 de agosto de 2026. Autor: ${AUTOR}.`,
    });
  } else if (activo2242.length > 1) {
    console.log("  AMBIGUO: hay varios 2242 activos. No se aplica.");
  } else if (candidatos2242.some((a) => a.deleted_at)) {
    console.log("  2242 ya está soft-deleted.");
  }

  console.log("\n=== Plan de baja ===");
  if (planes.length === 0) {
    console.log("  Nada que aplicar.");
    return;
  }
  for (const p of planes) {
    console.log(`  • ${displayAnimal(p.animal)}`);
    console.log(`    ${p.resumen}`);
  }

  if (!CONFIRM) {
    console.log("\nDRY-RUN. Ejecuta con --confirm para aplicar soft-delete + historial.");
    return;
  }

  console.log("\n=== Aplicando ===");
  for (const p of planes) {
    const a = p.animal;
    const corral = one(a.corrales);
    const estado = one(a.estados_animales);
    const raza = one(a.razas);

    const { error: eUpd } = await admin
      .from("animales")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", a.id)
      .is("deleted_at", null);
    if (eUpd) {
      console.log(`  ✗ ${a.arete}: ${eUpd.message}`);
      continue;
    }

    if (a.corral_id && (estado?.codigo ?? "activo") === "activo") {
      const { data: corralRow } = await admin
        .from("corrales")
        .select("ocupacion_actual")
        .eq("id", a.corral_id)
        .single();
      if (corralRow) {
        await admin
          .from("corrales")
          .update({
            ocupacion_actual: Math.max(0, Number(corralRow.ocupacion_actual ?? 0) - 1),
          })
          .eq("id", a.corral_id);
      }
    }

    const { error: eHist } = await admin.from("historial_sistema").insert({
      granja_id: a.granja_id,
      modulo: "animales",
      registro_id: a.id,
      referencia: p.referencia,
      accion: "eliminar",
      resumen: p.resumen,
      datos_anteriores: {
        arete: a.arete,
        raza: raza?.nombre ?? "—",
        sexo: a.sexo === "H" ? "Hembra" : "Macho",
        estado: estado?.nombre ?? estado?.codigo ?? "—",
        corral: corral?.nombre ?? "—",
        pesoInicialKg: Number(a.peso_inicial_kg ?? 0),
        pesoActualKg: Number(a.peso_actual_kg ?? 0),
        fechaIngreso: a.fecha_ingreso,
        observaciones: a.observaciones,
      },
      datos_nuevos: {
        autor: AUTOR,
        motivo: p.motivo,
        justificacion: p.resumen,
      },
      usuario_id: autorId,
    });
    if (eHist) {
      console.log(`  ⚠ ${a.arete} eliminado pero historial falló: ${eHist.message}`);
    } else {
      console.log(`  ✓ Baja ${a.arete} @ ${corral?.nombre ?? "?"} · historial ${AUTOR}`);
    }
  }

  console.log("\nListo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
