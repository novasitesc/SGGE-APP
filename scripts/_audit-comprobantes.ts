/**
 * Auditoría de comprobantes: estado, clasificación, emisor, monto.
 *   npx tsx scripts/_audit-comprobantes.ts
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

async function main() {
  const admin = createSupabaseAdmin();
  const g = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select(
      "id, archivo_nombre, estado, clasificacion, categoria_sugerida, confianza, emisor_nombre, emisor_identificacion, monto_total, fecha_emision, gasto_id, compra_id, factura_id"
    )
    .eq("granja_id", g)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const all = rows ?? [];
  const byEstado: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  for (const r of all) {
    byEstado[r.estado] = (byEstado[r.estado] ?? 0) + 1;
    byClass[r.clasificacion] = (byClass[r.clasificacion] ?? 0) + 1;
  }
  console.log(`Total: ${all.length}`);
  console.log("Por estado:", byEstado);
  console.log("Por clasificacion:", byClass);
  console.log("");

  const pendientes = all.filter((r) => r.estado === "pendiente");
  console.log(`=== PENDIENTES (${pendientes.length}) ===`);
  for (const r of pendientes) {
    console.log(
      [
        r.clasificacion.padEnd(14),
        (r.categoria_sugerida ?? "-").padEnd(5),
        String(r.confianza ?? 0).padStart(3) + "%",
        (r.monto_total != null ? `₡${Number(r.monto_total).toLocaleString("es-CR")}` : "sin monto").padStart(14),
        (r.emisor_nombre ?? "?").slice(0, 40).padEnd(40),
        r.archivo_nombre.slice(0, 55),
      ].join(" | ")
    );
  }

  const confirmados = all.filter((r) => r.estado === "confirmado");
  console.log(`\n=== CONFIRMADOS (${confirmados.length}) ===`);
  for (const r of confirmados) {
    console.log(
      [
        r.clasificacion.padEnd(14),
        (r.gasto_id ? "gasto" : r.compra_id ? "compra" : "?").padEnd(6),
        (r.monto_total != null ? `₡${Number(r.monto_total).toLocaleString("es-CR")}` : "?").padStart(14),
        (r.emisor_nombre ?? "?").slice(0, 35).padEnd(35),
        r.archivo_nombre.slice(0, 50),
      ].join(" | ")
    );
  }

  // Gastos registrados
  const { data: gastos } = await admin
    .from("gastos")
    .select("id, concepto, monto, fecha, categorias_gastos(codigo, nombre)")
    .eq("granja_id", g)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });
  console.log(`\n=== GASTOS EN BD (${gastos?.length ?? 0}) ===`);
  for (const gsto of gastos ?? []) {
    const rawCat = gsto.categorias_gastos as
      | { codigo: string; nombre: string }
      | { codigo: string; nombre: string }[]
      | null;
    const cat = Array.isArray(rawCat) ? rawCat[0] ?? null : rawCat;
    console.log(
      `  ${(cat?.codigo ?? "?").padEnd(5)} ₡${Number(gsto.monto).toLocaleString("es-CR").padStart(12)}  ${gsto.fecha}  ${(gsto.concepto ?? "").slice(0, 60)}`
    );
  }

  const { data: cats } = await admin.from("categorias_gastos").select("codigo, nombre").order("codigo");
  console.log("\nCategorías gasto disponibles:", cats?.map((c) => c.codigo).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
