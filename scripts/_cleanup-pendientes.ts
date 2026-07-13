/**
 * Soft-delete facturas propias / irrecuperables sin monto, o marca rechazado.
 * La BD no acepta clasificacion='ignorar' (check constraint).
 *   npx tsx scripts/_cleanup-pendientes.ts
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
import { CEDULA_GRANJA } from "@/lib/api/pdf/emisores-conocidos";

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre, estado, clasificacion, emisor_identificacion, monto_total")
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  for (const r of rows ?? []) {
    const isOwn =
      r.emisor_identificacion === CEDULA_GRANJA ||
      r.archivo_nombre.includes(CEDULA_GRANJA) ||
      r.archivo_nombre.includes("003101029993");

    if (!isOwn) continue;

    // Soft-delete: no entra a estadísticas ni bandeja
    const { error: e2 } = await admin
      .from("comprobantes")
      .update({
        deleted_at: new Date().toISOString(),
        emisor_nombre: "HERMANOS HERRERA PARRALES S.A. (factura propia)",
        emisor_identificacion: CEDULA_GRANJA,
        clasificacion: "pendiente",
      })
      .eq("id", r.id);
    if (e2) console.log("✗ propia", r.archivo_nombre.slice(0, 45), e2.message);
    else console.log("🗑 propia", r.archivo_nombre.slice(0, 45));
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
