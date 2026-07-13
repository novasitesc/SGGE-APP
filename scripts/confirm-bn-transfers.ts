/**
 * Confirma los 2 Comprobante639 (BN) con montos leídos de las capturas.
 *   npx tsx scripts/confirm-bn-transfers.ts
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

/** Por tamaño de página: el más corto es SINPE; el largo es CCSS. */
const SPECS = [
  {
    // Image ~short (SINPE 20k) — MediaBox contents were smaller in prior dump
    match: "Comprobante639168597881662342",
    category: "OTRO",
    amount: 20000,
    date: "2026-06-12",
    issuer: "Banco Nacional / SINPE Móvil",
    description: "SINPE Móvil ₡20.000 a JOSE DAVID JARA GUERRERO (comp. 12640681) — BAJOCK ORQUIDEA",
  },
  {
    match: "Comprobante639168713010015531",
    category: "MO",
    amount: 645544,
    date: "2026-06-12",
    issuer: "CCSS — Caja Costarricense de Seguro Social",
    description: "Cuota obrero-patronal período 202605 (comp. BN 13037521)",
  },
];

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre")
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null)
    .ilike("archivo_nombre", "%Comprobante639%");
  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    const spec = SPECS.find((s) => row.archivo_nombre.includes(s.match));
    if (!spec) {
      console.log("· sin match", row.archivo_nombre);
      continue;
    }
    const res = await confirmComprobante(admin, granjaId, row.id, {
      classification: "gasto",
      issuer: spec.issuer,
      issueDate: spec.date,
      amount: spec.amount,
      categoryCode: spec.category,
      description: spec.description,
    });
    if (res.ok) console.log(`✓ ${spec.category} ₡${spec.amount.toLocaleString("es-CR")} ${row.archivo_nombre}`);
    else console.log(`✗ ${row.archivo_nombre}: ${res.message}`);
  }

  const { count: nPend } = await admin
    .from("comprobantes")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null);
  console.log("Pendientes restantes:", nPend);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
