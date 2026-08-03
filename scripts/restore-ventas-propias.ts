/**
 * Reactiva facturas propias soft-deleted y las deja listas como VENTA.
 *
 * Por defecto: restaura → pendiente / clasificacion=venta (aparecen en Comprobantes).
 * Con monto + buyer en OVERRIDES y CONFIRM=true: confirma e inserta en `ventas`.
 *
 *   npx tsx scripts/restore-ventas-propias.ts
 *   npx tsx scripts/restore-ventas-propias.ts --confirm
 *
 * Completa monto/buyer abajo (o en emisores-conocidos overrideForFileName) antes de --confirm.
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
import { confirmComprobante } from "@/lib/api/comprobantes";
import {
  CEDULA_GRANJA,
  overrideForFileName,
} from "@/lib/api/pdf/emisores-conocidos";
import { findClaveCR, parseClaveCR } from "@/lib/api/pdf/clave-cr";

/**
 * Datos manuales / XML. Deja monto/buyer en null hasta tenerlos.
 * Con --confirm solo se confirman filas con monto > 0 y buyer no vacío.
 */
const OVERRIDES: Record<
  string,
  { monto?: number; buyer?: string; pesoKg?: number; descripcion?: string }
> = {
  // Factura #361 — 2026-06-08 — 8 toros, 2359.30 kg × ₡2925
  "0000000361": {
    monto: 6969962.03,
    buyer: "JIMMY FRANCISCO MATIAS JIMENEZ",
    pesoKg: 2359.3,
    descripcion: "GANADO CANAL 8 TOROS — boleta 97744",
  },
  // Factura #363 — 2026-06-30 — 4 toros, 1242.1 kg × ₡2925
  "0000000363": {
    monto: 3669473.93,
    buyer: "JIMMY FRANCISCO MATIAS JIMENEZ",
    pesoKg: 1242.1,
    descripcion: "GANADO CANAL 4 TOROS — boleta 98628",
  },
};

function folioKeyFromName(name: string): string | null {
  const clave = findClaveCR(name);
  const info = clave ? parseClaveCR(clave) : null;
  if (!info) return null;
  const num = info.consecutivo.slice(-10); // 0000000361
  return num;
}

function isOwn(name: string, emisorId: string | null): boolean {
  return (
    emisorId === CEDULA_GRANJA ||
    name.includes(CEDULA_GRANJA) ||
    name.includes("003101029993")
  );
}

async function main() {
  const doConfirm = process.argv.includes("--confirm");
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}`);
  console.log(`Modo: ${doConfirm ? "RESTAURAR + CONFIRMAR" : "solo RESTAURAR → pendiente"}\n`);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select(
      "id, archivo_nombre, estado, clasificacion, monto_total, fecha_emision, emisor_identificacion, emisor_nombre, deleted_at, clave_fiscal, folio_fiscal"
    )
    .eq("granja_id", granjaId);
  if (error) throw new Error(error.message);

  const propios = (rows ?? []).filter((r) =>
    isOwn(r.archivo_nombre, r.emisor_identificacion)
  );
  if (propios.length === 0) {
    console.log("No hay comprobantes propios (activos ni soft-deleted).");
    return;
  }

  let restored = 0;
  let confirmed = 0;
  let skipped = 0;

  for (const row of propios) {
    const folioKey = folioKeyFromName(row.archivo_nombre);
    const manual = folioKey ? OVERRIDES[folioKey] : undefined;
    const fileOv = overrideForFileName(row.archivo_nombre);
    const monto =
      manual?.monto ??
      fileOv?.monto ??
      (row.monto_total != null ? Number(row.monto_total) : null);
    const buyer = manual?.buyer ?? fileOv?.buyer ?? null;
    const pesoKg = manual?.pesoKg ?? fileOv?.pesoKg ?? null;
    const fecha =
      fileOv?.fecha ??
      row.fecha_emision ??
      (findClaveCR(row.archivo_nombre)
        ? parseClaveCR(findClaveCR(row.archivo_nombre)!)?.fechaEmision
        : null);
    const descripcion =
      manual?.descripcion ?? fileOv?.descripcion ?? `Venta — ${row.archivo_nombre}`;

    // Restaurar a bandeja pendiente / venta
    let patch: Record<string, unknown> = {
      deleted_at: null,
      estado: "pendiente",
      clasificacion: "venta",
      emisor_nombre: "HERMANOS HERRERA PARRALES S.A.",
      emisor_identificacion: CEDULA_GRANJA,
      fecha_emision: fecha,
      monto_total: monto != null && monto > 0 ? monto : row.monto_total,
      confianza: 96,
      categoria_sugerida: null,
      gasto_id: null,
      compra_id: null,
    };

    let { error: eRest } = await admin
      .from("comprobantes")
      .update(patch)
      .eq("id", row.id);

    // Si el CHECK de BD aún no incluye 'venta', dejar pendiente y avisar.
    if (eRest?.message?.includes("comprobantes_clasificacion_check")) {
      console.log(
        "⚠ CHECK BD sin 'venta'. Restaurando como pendiente. Aplica la migración primero."
      );
      patch = { ...patch, clasificacion: "pendiente" };
      const retry = await admin.from("comprobantes").update(patch).eq("id", row.id);
      eRest = retry.error;
    }

    if (eRest) {
      console.log(`✗ restaurar ${row.archivo_nombre.slice(0, 50)}: ${eRest.message}`);
      continue;
    }
    restored += 1;
    console.log(
      `↺ pendiente/venta  folio=${folioKey ?? "?"}  ₡${monto ?? "—"}  buyer=${buyer ?? "—"}  ${row.archivo_nombre.slice(0, 48)}`
    );

    if (!doConfirm) continue;

    if (monto == null || !(monto > 0) || !buyer?.trim()) {
      skipped += 1;
      console.log(
        `  · sin confirmar (falta monto y/o buyer). Completa OVERRIDES["${folioKey}"] y re-ejecuta con --confirm.`
      );
      continue;
    }

    const res = await confirmComprobante(admin, granjaId, row.id, {
      classification: "venta",
      issuer: "HERMANOS HERRERA PARRALES S.A.",
      issuerId: CEDULA_GRANJA,
      issueDate: fecha,
      amount: monto,
      buyer: buyer.trim(),
      totalWeightKg: pesoKg,
      description: descripcion,
    });
    if (res.ok) {
      confirmed += 1;
      console.log(`  ✓ venta confirmada ₡${monto.toLocaleString("es-CR")} → ${buyer}`);
    } else {
      console.log(`  ✗ confirmar: ${res.message}`);
    }
  }

  const [{ count: nPend }, { count: nVentas }] = await Promise.all([
    admin
      .from("comprobantes")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .eq("estado", "pendiente")
      .eq("clasificacion", "venta")
      .is("deleted_at", null),
    admin
      .from("ventas")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .is("deleted_at", null),
  ]);

  console.log("\n" + "─".repeat(55));
  console.log(`Restaurados: ${restored} | Confirmados: ${confirmed} | Sin datos: ${skipped}`);
  console.log(`Pendientes venta en bandeja: ${nPend} | Ventas en BD: ${nVentas}`);
  if (!doConfirm) {
    console.log(
      "\nSiguiente: completa monto/buyer en scripts/restore-ventas-propias.ts (OVERRIDES)"
    );
    console.log("o confirma desde Comprobantes → Revisar → Venta.");
    console.log("Luego: npx tsx scripts/restore-ventas-propias.ts --confirm");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
