/**
 * Resumen: gastos/compras/animales por categoría para verificar dashboard.
 *   npx tsx scripts/_verify-stats.ts
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

  const [{ data: gastos }, { data: compras }, { count: nAnim }, { count: nPend }] = await Promise.all([
    admin
      .from("gastos")
      .select("monto, categorias_gastos(codigo)")
      .eq("granja_id", g)
      .is("deleted_at", null),
    admin.from("compras").select("id, total, proveedor, fecha").eq("granja_id", g).is("deleted_at", null),
    admin.from("animales").select("id", { count: "exact", head: true }).eq("granja_id", g).is("deleted_at", null),
    admin
      .from("comprobantes")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", g)
      .eq("estado", "pendiente")
      .is("deleted_at", null),
  ]);

  const byCat: Record<string, { n: number; sum: number }> = {};
  let totalG = 0;
  for (const row of gastos ?? []) {
    const codigo = (row.categorias_gastos as { codigo?: string } | null)?.codigo ?? "?";
    byCat[codigo] ??= { n: 0, sum: 0 };
    byCat[codigo].n += 1;
    byCat[codigo].sum += Number(row.monto) || 0;
    totalG += Number(row.monto) || 0;
  }

  console.log("=== GASTOS por categoría ===");
  for (const [c, v] of Object.entries(byCat).sort()) {
    console.log(`  ${c.padEnd(6)} ${String(v.n).padStart(3)} regs   ₡${v.sum.toLocaleString("es-CR")}`);
  }
  console.log(`  TOTAL ${String(gastos?.length ?? 0).padStart(3)} regs   ₡${totalG.toLocaleString("es-CR")}`);

  console.log("\n=== COMPRAS GANADO ===");
  let totalC = 0;
  for (const c of compras ?? []) {
    totalC += Number(c.total) || 0;
    console.log(`  ₡${Number(c.total).toLocaleString("es-CR").padStart(12)}  ${(c.proveedor ?? "").slice(0, 40)}`);
  }
  console.log(`  TOTAL ₡${totalC.toLocaleString("es-CR")} (${compras?.length ?? 0} compras)`);
  console.log(`\nAnimales: ${nAnim} | Comprobantes pendientes (ilegibles): ${nPend}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
