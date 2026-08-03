/**
 * Sincroniza gastos ALIM confirmados → alimentos + alimentaciones.
 * Uso: npx tsx scripts/backfill-alim-alimentaciones.ts
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";
import {
  esGastoComidaHumana,
  sincronizarAlimentacionDesdeGastoAlim,
} from "../lib/api/alim-from-comprobante";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: cat, error: eCat } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", "ALIM")
    .maybeSingle();
  if (eCat) throw eCat;
  if (!cat) throw new Error("Categoría ALIM no encontrada");

  const { data: gastos, error } = await admin
    .from("gastos")
    .select("id, granja_id, fecha, concepto, monto, referencia")
    .eq("categoria_id", cat.id)
    .is("deleted_at", null)
    .order("fecha", { ascending: true });
  if (error) throw error;

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const g of gastos ?? []) {
    const { data: comp } = await admin
      .from("comprobantes")
      .select("archivo_nombre, emisor_identificacion, emisor_nombre")
      .eq("gasto_id", g.id)
      .maybeSingle();

    const syncInput = {
      granjaId: g.granja_id,
      gastoId: g.id,
      fecha: g.fecha,
      monto: Number(g.monto),
      emisorId: comp?.emisor_identificacion ?? null,
      emisorNombre: comp?.emisor_nombre ?? null,
      concepto: g.concepto,
      archivoNombre: comp?.archivo_nombre ?? g.referencia,
    };

    if (esGastoComidaHumana(syncInput)) {
      skipped++;
      console.log("SKIP  (comida humana)", g.fecha, (g.concepto ?? "").slice(0, 50));
      continue;
    }

    try {
      const result = await sincronizarAlimentacionDesdeGastoAlim(admin, syncInput);
      if (!result) {
        skipped++;
        continue;
      }
      if (result.created) created++;
      else skipped++;
      console.log(
        result.created ? "CREATE" : "SKIP ",
        g.fecha,
        Number(g.monto).toFixed(2),
        (g.concepto ?? "").slice(0, 50)
      );
    } catch (e) {
      failed++;
      console.error("FAIL", g.id, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nListo: created=${created} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
