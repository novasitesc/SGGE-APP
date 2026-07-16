/**
 * Compara archivos en PDF/ con filas en `comprobantes` y resume
 * cuánto está montado en la app (confirmado → gastos/compras vs pendiente).
 *
 *   npx tsx scripts/_audit-pdf-cobertura.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

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

function normalizeName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function main() {
  const pdfDir = join(appRoot, "PDF");
  const files = existsSync(pdfDir)
    ? readdirSync(pdfDir).filter((f) => /\.(pdf|png|jpe?g)$/i.test(extname(f)))
    : [];
  const uniqueLocal = [...new Set(files.map(normalizeName))];

  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select(
      "id, archivo_nombre, estado, clasificacion, monto_total, emisor_nombre, gasto_id, compra_id, deleted_at"
    )
    .eq("granja_id", granjaId);
  if (error) throw new Error(error.message);

  const all = rows ?? [];
  const activos = all.filter((r) => !r.deleted_at);
  const borrados = all.filter((r) => r.deleted_at);

  const byEstado: Record<string, number> = {};
  for (const r of activos) {
    byEstado[r.estado] = (byEstado[r.estado] ?? 0) + 1;
  }

  const confirmados = activos.filter((r) => r.estado === "confirmado");
  const pendientes = activos.filter((r) => r.estado === "pendiente");
  const conGasto = confirmados.filter((r) => r.gasto_id);
  const conCompra = confirmados.filter((r) => r.compra_id);

  const dbNames = new Set(activos.map((r) => normalizeName(r.archivo_nombre)));
  const localInDb = uniqueLocal.filter((n) => {
    // match por nombre exacto o por inclusión (sufijos/claves)
    if (dbNames.has(n)) return true;
    for (const db of dbNames) {
      if (db.includes(n) || n.includes(db)) return true;
      // match por clave larga numérica embebida
      const digits = n.match(/\d{20,}/g) ?? [];
      if (digits.some((d) => db.includes(d))) return true;
      const bnDoc = n.match(/BN-EXTRACTO-(\d+)/);
      if (bnDoc && db.includes(bnDoc[1])) return true;
    }
    return false;
  });
  const localMissing = uniqueLocal.filter((n) => !localInDb.includes(n));

  const [{ count: nGastos }, { count: nCompras }, { data: extractoBn }] =
    await Promise.all([
      admin
        .from("gastos")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("compras")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("comprobantes")
        .select("id, archivo_nombre, estado, monto_total, emisor_nombre, gasto_id")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .ilike("archivo_nombre", "%BN-EXTRACTO%"),
    ]);

  console.log("=== Cobertura PDF ↔ aplicación ===\n");
  console.log(`Carpeta PDF/: ${files.length} archivos (${uniqueLocal.length} nombres únicos)`);
  console.log(`Comprobantes activos: ${activos.length} | soft-deleted: ${borrados.length}`);
  console.log(`  por estado: ${JSON.stringify(byEstado)}`);
  console.log(`  confirmados con gasto:  ${conGasto.length}`);
  console.log(`  confirmados con compra: ${conCompra.length}`);
  console.log(`  pendientes (bandeja):   ${pendientes.length}`);
  console.log(`\nTablas de negocio:`);
  console.log(`  gastos:  ${nGastos}`);
  console.log(`  compras: ${nCompras}`);

  console.log(`\nPDF locales presentes en BD: ${localInDb.length}/${uniqueLocal.length}`);
  if (localMissing.length) {
    console.log(`  Faltan en BD (${localMissing.length}):`);
    for (const n of localMissing.slice(0, 40)) console.log(`    - ${n.slice(0, 80)}`);
    if (localMissing.length > 40) console.log(`    … y ${localMissing.length - 40} más`);
  }

  if (pendientes.length) {
    console.log(`\nPendientes en bandeja (${pendientes.length}):`);
    for (const p of pendientes) {
      console.log(
        `  · ${p.archivo_nombre.slice(0, 55)} | ${p.clasificacion} | ₡${Number(p.monto_total ?? 0).toLocaleString("es-CR")} | ${(p.emisor_nombre ?? "").slice(0, 30)}`
      );
    }
  } else {
    console.log("\nBandeja de pendientes: vacía ✓");
  }

  console.log(`\n=== Lote extracto BN (BN-EXTRACTO-*) ===`);
  const bn = extractoBn ?? [];
  console.log(`  registros: ${bn.length}`);
  let sumBn = 0;
  for (const r of bn) {
    sumBn += Number(r.monto_total) || 0;
    console.log(
      `  ${r.estado.padEnd(11)} ₡${String(Number(r.monto_total ?? 0).toLocaleString("es-CR")).padStart(12)}  ${(r.emisor_nombre ?? "").padEnd(10)}  gasto=${r.gasto_id ? "sí" : "no"}  ${r.archivo_nombre}`
    );
  }
  console.log(`  suma montos: ₡${sumBn.toLocaleString("es-CR")}`);

  const montado =
    pendientes.length === 0 && localMissing.length === 0
      ? "SÍ — todos los PDF locales están en BD y no hay pendientes"
      : localMissing.length === 0 && pendientes.length > 0
        ? `PARCIAL — PDFs en BD, pero ${pendientes.length} aún en bandeja (no montados en gastos/compras)`
        : `NO completo — faltan ${localMissing.length} en BD y/o ${pendientes.length} pendientes`;
  console.log(`\n¿Datos PDF montados en la vista del programa? ${montado}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
