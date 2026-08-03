/**
 * Sincroniza gastos/comprobantes con líneas VET → medicamentos + tratamientos.
 * Uso: npx tsx --env-file=.env.local scripts/backfill-vet-salud.ts
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";
import {
  extractLineasVeterinarias,
  sincronizarSaludDesdeGastoVet,
} from "../lib/api/vet-from-comprobante";

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

  const { data: cat } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", "VET")
    .maybeSingle();

  const { data: comps, error } = await admin
    .from("comprobantes")
    .select(
      "id, granja_id, gasto_id, archivo_nombre, emisor_nombre, fecha_emision, monto_total, categoria_sugerida, estado, texto_extraido, datos_parseados"
    )
    .eq("estado", "confirmado")
    .not("gasto_id", "is", null)
    .limit(500);
  if (error) throw error;

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  for (const c of comps ?? []) {
    const datos = (c.datos_parseados ?? {}) as {
      parsed?: { texto?: string };
    };
    const texto =
      c.texto_extraido ||
      datos.parsed?.texto ||
      "";
    const lineas = extractLineasVeterinarias(texto);
    let isVet = (c.categoria_sugerida ?? "").toUpperCase() === "VET";

    // Resolver granja desde gasto si falta
    let granjaId = c.granja_id as string | null;
    let fecha = c.fecha_emision as string | null;
    let monto = Number(c.monto_total ?? 0);
    let concepto: string | null = c.archivo_nombre;

    if (c.gasto_id) {
      const { data: g } = await admin
        .from("gastos")
        .select("id, granja_id, fecha, monto, concepto, categoria_id")
        .eq("id", c.gasto_id)
        .maybeSingle();
      if (g) {
        granjaId = g.granja_id;
        fecha = g.fecha;
        monto = Number(g.monto);
        concepto = g.concepto;
        if (cat?.id && g.categoria_id === cat.id) isVet = true;
      }
    }

    if (!isVet && lineas.length === 0) continue;
    scanned += 1;

    if (!granjaId || !fecha || !c.gasto_id) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sincronizarSaludDesdeGastoVet(admin, {
        granjaId,
        gastoId: c.gasto_id,
        fecha,
        monto,
        texto,
        concepto,
        archivoNombre: c.archivo_nombre,
        fallbackTotal: isVet && lineas.length === 0,
      });
      created += result.created;
      skipped += result.skipped;
      console.log(
        result.created > 0 ? "CREATE" : "SKIP ",
        c.fecha_emision,
        (c.archivo_nombre ?? "").slice(0, 40),
        `+${result.created}/${result.lineas.length} líneas`
      );
    } catch (e) {
      failed += 1;
      console.error(
        "FAIL ",
        c.id,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log(
    JSON.stringify({ scanned, created, skipped, failed }, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
