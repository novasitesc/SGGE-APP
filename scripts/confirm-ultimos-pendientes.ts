/**
 * Confirma los 8 pendientes restantes según clasificación del usuario.
 *   npx tsx scripts/confirm-ultimos-pendientes.ts
 */
import { readFileSync, existsSync } from "node:fs";
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

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { confirmComprobante } from "@/lib/api/comprobantes";

type Spec = {
  match: string;
  action: "gasto" | "duplicado" | "salto";
  categoria?: string;
  monto?: number;
  fecha?: string;
  emisor?: string;
  emisorId?: string;
  descripcion?: string;
  note?: string;
};

const SPECS: Spec[] = [
  // Transferencias bancarias (imagen) — sin monto visible
  {
    match: "Comprobante639168597881662342",
    action: "salto",
    note: "Transferencia bancaria sin monto en el PDF — falta monto manual",
  },
  {
    match: "Comprobante639168713010015531",
    action: "salto",
    note: "Transferencia bancaria sin monto en el PDF — falta monto manual",
  },

  // INS — póliza riesgos del trabajo
  {
    match: "4000001902",
    action: "gasto",
    categoria: "OTRO",
    monto: 543108,
    fecha: "2026-07-01",
    emisor: "Instituto Nacional de Seguros (INS)",
    emisorId: "4000001902",
    descripcion: "Pago de póliza 8316104 — Riesgos del Trabajo (jul–sep 2026)",
  },

  // Transporte ganado — Seis Hermanos Herresal
  {
    match: "00000373100008081",
    action: "gasto",
    categoria: "TRANS",
    monto: 650000,
    fecha: "2026-06-30",
    emisor: "Seis Hermanos Herresal S.A.",
    emisorId: "3101533933",
    descripcion: "Transporte ganado / fletes camión junio 2026",
  },

  // Vitaminas/minerales Dos Pinos (NO es transporte — el PDF lo indica)
  {
    match: "00000374100008081",
    action: "gasto",
    categoria: "ALIM",
    monto: 619545.31,
    fecha: "2026-06-30",
    emisor: "Seis Hermanos Herresal S.A.",
    emisorId: "3101533933",
    descripcion: "Vitaminas, minerales y suministros ganado D.P. junio 2026",
  },

  // DOC-Recepcion = representaciones de FCs Dos Pinos YA confirmadas → no duplicar
  {
    match: "DOC-Recepcion (69)",
    action: "duplicado",
    note: "Copia gráfica de FC-516…376347 (Grofactor ₡1.123.120) ya en ALIM",
  },
  {
    match: "DOC-Recepcion (70)",
    action: "duplicado",
    note: "Copia gráfica de FC-511…294393 (Melaza ₡1.324.310,79) ya en ALIM",
  },

  // Corporación ZUCA — material tajo + transporte remodelación
  {
    match: "3101546580",
    action: "gasto",
    categoria: "MANT",
    monto: 504000.11,
    fecha: "2026-06-30",
    emisor: "Corporación ZUCA C.Z. S.A.",
    emisorId: "3101546580",
    descripcion: "36 m³ material tajo + transporte (remodelación/construcción)",
  },
];

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre, estado")
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    const spec = SPECS.find((s) => row.archivo_nombre.includes(s.match) || row.archivo_nombre.toUpperCase().includes(s.match.toUpperCase()));
    if (!spec) {
      console.log("· sin spec:", row.archivo_nombre.slice(0, 55));
      continue;
    }

    if (spec.action === "salto") {
      console.log(`⏭ ${row.archivo_nombre.slice(0, 45)} — ${spec.note}`);
      continue;
    }

    if (spec.action === "duplicado") {
      const { error: e } = await admin
        .from("comprobantes")
        .update({
          deleted_at: new Date().toISOString(),
          clasificacion: "gasto",
          categoria_sugerida: "ALIM",
          emisor_nombre: "Dos Pinos (documento recepción — duplicado)",
        })
        .eq("id", row.id);
      if (e) console.log("✗ dup", e.message);
      else console.log(`🗑 duplicado ${row.archivo_nombre.slice(0, 40)} — ${spec.note}`);
      continue;
    }

    const res = await confirmComprobante(admin, granjaId, row.id, {
      classification: "gasto",
      issuer: spec.emisor,
      issuerId: spec.emisorId,
      issueDate: spec.fecha,
      amount: spec.monto!,
      categoryCode: spec.categoria!,
      description: spec.descripcion,
    });
    if (res.ok) {
      console.log(`✓ ${spec.categoria} ₡${spec.monto!.toLocaleString("es-CR")} ${row.archivo_nombre.slice(0, 40)}`);
    } else {
      console.log(`✗ ${row.archivo_nombre.slice(0, 40)}: ${res.message}`);
    }
  }

  const { count: nPend } = await admin
    .from("comprobantes")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null);
  const { count: nGast } = await admin
    .from("gastos")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .is("deleted_at", null);

  console.log("\nPendientes:", nPend, "| Gastos:", nGast);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
