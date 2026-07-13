/**
 * Marca facturas propias de la granja (3101029993) como ignorar.
 *   npx tsx scripts/_mark-ignore-propias.ts
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
    .select("id, archivo_nombre, estado, clasificacion, emisor_identificacion")
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
    const { error: e2 } = await admin
      .from("comprobantes")
      .update({
        estado: "confirmado",
        clasificacion: "ignorar",
        emisor_nombre: "HERMANOS HERRERA PARRALES S.A.",
        emisor_identificacion: CEDULA_GRANJA,
      })
      .eq("id", r.id);
    if (e2) console.log("✗", r.archivo_nombre.slice(0, 50), e2.message);
    else console.log("⊘", r.archivo_nombre.slice(0, 50));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
