/**
 * Corrige categoría ALIM en gastos FE tilapia (003101211148) confirmados como OTRO.
 *   npx tsx scripts/_fix-tilapia-alim.ts
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
  const granjaId = await resolveGranjaId(admin, null);

  const { data: alim, error: catErr } = await admin
    .from("categorias_gastos")
    .select("id, codigo")
    .eq("codigo", "ALIM")
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  if (!alim) throw new Error("No existe categoría ALIM");

  const { data: comps } = await admin
    .from("comprobantes")
    .select("id, gasto_id, archivo_nombre, categoria_sugerida")
    .eq("granja_id", granjaId)
    .ilike("archivo_nombre", "%003101211148%")
    .not("gasto_id", "is", null);

  console.log("FE encontrados:", comps?.length ?? 0);
  for (const c of comps ?? []) {
    await admin.from("comprobantes").update({ categoria_sugerida: "ALIM", emisor_nombre: "Inversiones OSO / Tilapia" }).eq("id", c.id);
    const { error } = await admin
      .from("gastos")
      .update({
        categoria_id: alim.id,
        concepto: "Filet de tilapia — Inversiones OSO".slice(0, 255),
      })
      .eq("id", c.gasto_id!);
    if (error) console.log("✗", c.archivo_nombre, error.message);
    else console.log("✓ ALIM", c.archivo_nombre.slice(0, 50));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
