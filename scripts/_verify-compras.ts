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
  const { data, error } = await admin.from("compras_animales").select("*").eq("granja_id", g).limit(8);
  console.log(error?.message ?? "ok");
  if (data?.[0]) console.log("cols", Object.keys(data[0]));
  let total = 0;
  for (const c of data ?? []) {
    const monto = Number((c as { monto_total?: number }).monto_total ?? (c as { total?: number }).total ?? 0);
    total += monto;
    console.log(JSON.stringify(c).slice(0, 180));
  }
  // get all for sum
  const { data: all } = await admin.from("compras_animales").select("monto_total").eq("granja_id", g);
  const sum = (all ?? []).reduce((a, r) => a + (Number(r.monto_total) || 0), 0);
  console.log("n=", all?.length, "sum=", sum);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
