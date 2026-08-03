/**
 * Corrige cantidades inventadas (monto ÷ precio catálogo) en compras ALIM.
 * Cada línea turno=compra pasa a: cantidad=1, costo_unitario=subtotal (1 compra/lote).
 *
 * Uso: npx tsx --env-file=.env.local scripts/normalize-alim-compra-cantidades.ts
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v;
}

async function main() {
  const admin = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: compras, error } = await admin
    .from("alimentaciones")
    .select("id")
    .eq("turno", "compra")
    .is("deleted_at", null);
  if (error) throw error;

  const ids = (compras ?? []).map((c) => c.id);
  console.log(`Compras (cabeceras): ${ids.length}`);
  if (ids.length === 0) return;

  let updated = 0;
  let skipped = 0;
  const CHUNK = 80;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data: dets, error: eDet } = await admin
      .from("detalle_alimentaciones")
      .select("id, cantidad, subtotal, costo_unitario")
      .in("alimentacion_id", slice);
    if (eDet) throw eDet;

    for (const d of dets ?? []) {
      const qty = Number(d.cantidad) || 0;
      const sub = Math.round((Number(d.subtotal) || 0) * 100) / 100;
      const unit = qty > 0 ? sub / qty : 0;
      const needsFix = qty > 1.0001 || qty > 5_000 || unit > 5_000 || qty <= 0;
      if (!needsFix && Math.abs(qty - 1) < 0.0001) {
        skipped++;
        continue;
      }
      const { error: eUp } = await admin
        .from("detalle_alimentaciones")
        .update({
          cantidad: 1,
          costo_unitario: sub,
        })
        .eq("id", d.id);
      if (eUp) throw eUp;
      updated++;
    }
  }

  console.log(`Listo: updated=${updated} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
