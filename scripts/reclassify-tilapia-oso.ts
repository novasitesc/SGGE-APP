/**
 * Reclasifica gastos OSO/tilapia de ALIM → OTRO y limpia alimentaciones/catálogo.
 * Uso: pnpm exec tsx --env-file=.env.local scripts/reclassify-tilapia-oso.ts
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: cats } = await admin
    .from("categorias_gastos")
    .select("id, codigo")
    .in("codigo", ["ALIM", "OTRO"]);
  const alimId = cats?.find((c) => c.codigo === "ALIM")?.id;
  const otroId = cats?.find((c) => c.codigo === "OTRO")?.id;
  if (!alimId || !otroId) throw new Error("Faltan categorías ALIM/OTRO");

  const { data: comps } = await admin
    .from("comprobantes")
    .select("id, gasto_id, archivo_nombre")
    .or(
      "emisor_identificacion.eq.3101211148,emisor_identificacion.eq.003101211148,emisor_nombre.ilike.%tilapia%,emisor_nombre.ilike.%oso%,archivo_nombre.ilike.%3101211148%"
    );

  const gastoIds = (comps ?? [])
    .map((c) => c.gasto_id)
    .filter((id): id is string => !!id);

  console.log("comprobantes OSO/tilapia:", comps?.length ?? 0, "gastos:", gastoIds.length);

  if (gastoIds.length > 0) {
    const { data: updated, error } = await admin
      .from("gastos")
      .update({ categoria_id: otroId })
      .in("id", gastoIds)
      .eq("categoria_id", alimId)
      .select("id, concepto, monto");
    if (error) throw error;
    console.log("gastos reclasificados a OTRO:", updated?.length ?? 0);
    for (const g of updated ?? []) {
      console.log(" ", g.concepto, g.monto);
    }
  }

  // Soft-delete alimentaciones sync de esos gastos
  for (const gid of gastoIds) {
    const marker = `gasto:${gid}`;
    const { data: cabs } = await admin
      .from("alimentaciones")
      .select("id")
      .ilike("observaciones", `%${marker}%`)
      .is("deleted_at", null);
    for (const c of cabs ?? []) {
      await admin
        .from("alimentaciones")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", c.id);
      console.log("alimentacion soft-deleted", c.id);
    }
  }

  // Desactivar producto TIL-OSO del catálogo
  const { data: alims } = await admin
    .from("alimentos")
    .update({ activo: false, deleted_at: new Date().toISOString() })
    .or("codigo.eq.TIL-OSO,nombre.ilike.%tilapia%")
    .is("deleted_at", null)
    .select("id, codigo, nombre");
  console.log("alimentos desactivados:", alims);

  // Comprobantes: categoría sugerida OTRO
  if ((comps ?? []).length > 0) {
    await admin
      .from("comprobantes")
      .update({ categoria_sugerida: "OTRO" })
      .in(
        "id",
        (comps ?? []).map((c) => c.id)
      );
  }

  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
