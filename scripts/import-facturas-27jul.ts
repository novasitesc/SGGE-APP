/**
 * Importa y confirma las 5 facturas del 27-07-2026 (PDF/).
 *
 *   npx tsx scripts/import-facturas-27jul.ts
 *   npx tsx scripts/import-facturas-27jul.ts --confirm
 */
import { readFileSync, existsSync } from "node:fs";
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
import { uploadComprobante, confirmComprobante } from "@/lib/api/comprobantes";
import { overrideForFileName } from "@/lib/api/pdf/emisores-conocidos";

const FILES = [
  "eFAC_50627072600310157145300100008010000032208145752745.pdf",
  "50627072600310200722302600042010000001594100000000.pdf",
  "50627072600310138336309900001010000041242128711310.pdf",
  "50627072600310119718700100001010000799458100000000.pdf",
  "003101211148-FE-00400015010000000658.pdf",
] as const;

/** Cantidad ALIM (kg) cuando aplica — maíz AVIN: 43 sacos × 46 kg. */
const CANTIDAD_ALIM: Record<string, number> = {
  "3101383363": 43 * 46,
};

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/pdf";
}

async function main() {
  const doConfirm = process.argv.includes("--confirm");
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  const pdfDir = join(appRoot, "PDF");

  console.log(`Granja: ${granjaId}`);
  console.log(`Modo: ${doConfirm ? "IMPORTAR + CONFIRMAR" : "solo IMPORTAR"}\n`);

  let uploaded = 0;
  let dup = 0;
  let confirmed = 0;
  let fail = 0;

  for (const name of FILES) {
    const path = join(pdfDir, name);
    if (!existsSync(path)) {
      console.log(`✗ no existe: ${name}`);
      fail++;
      continue;
    }

    const buffer = readFileSync(path);
    const res = await uploadComprobante(admin, granjaId, {
      buffer,
      name,
      mime: mimeFor(name),
    });

    if (!res.ok) {
      console.log(`✗ upload ${name.slice(0, 50)}: ${res.message}`);
      fail++;
      continue;
    }

    if (res.duplicated) {
      dup++;
      console.log(`↺ duplicado (ya en BD): ${name.slice(0, 55)}`);
    } else {
      uploaded++;
      console.log(
        `✓ subido  ${name.slice(0, 50)}  · ₡${res.comprobante.amount?.toLocaleString("es-CR") ?? "—"}  · ${res.comprobante.issuer ?? "?"}`
      );
    }

    if (!doConfirm) continue;

    const ov = overrideForFileName(name);
    const monto =
      ov?.monto ??
      (res.comprobante.amount != null ? Number(res.comprobante.amount) : null);
    const categoria = ov?.categoria ?? res.comprobante.suggestedCategory ?? "OTRO";
    const emisor = ov?.emisorNombre ?? res.comprobante.issuer ?? "Proveedor";
    const emisorId = ov?.emisorId ?? res.comprobante.issuerId ?? null;
    const fecha = ov?.fecha ?? res.comprobante.issueDate ?? "2026-07-27";
    const descripcion = ov?.descripcion ?? `Gasto — ${name}`;
    const cantidadAlim = emisorId ? CANTIDAD_ALIM[emisorId] : undefined;

    if (monto == null || !(monto > 0)) {
      console.log(`  · sin confirmar (falta monto)`);
      continue;
    }

    // Buscar el comprobante por nombre (puede ser el recién subido o el duplicado)
    const { data: row } = await admin
      .from("comprobantes")
      .select("id, estado, gasto_id")
      .eq("granja_id", granjaId)
      .eq("archivo_nombre", name)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      console.log(`  · no encontrado en BD tras upload`);
      fail++;
      continue;
    }
    if (row.estado === "confirmado") {
      console.log(`  · ya confirmado (gasto=${row.gasto_id ?? "—"})`);
      continue;
    }

    const conf = await confirmComprobante(admin, granjaId, row.id, {
      classification: "gasto",
      issuer: emisor,
      issuerId: emisorId,
      issueDate: fecha,
      amount: monto,
      categoryCode: categoria,
      description: descripcion,
      cantidadAlim: cantidadAlim ?? null,
    });

    if (conf.ok) {
      confirmed++;
      console.log(
        `  ✓ gasto ${categoria} ₡${monto.toLocaleString("es-CR")} — ${emisor}`
      );
    } else {
      fail++;
      console.log(`  ✗ confirmar: ${conf.message}`);
    }
  }

  console.log("\n" + "─".repeat(55));
  console.log(
    `Subidos: ${uploaded} | Duplicados: ${dup} | Confirmados: ${confirmed} | Fallos: ${fail}`
  );
  if (!doConfirm) {
    console.log("\nSiguiente: npx tsx scripts/import-facturas-27jul.ts --confirm");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
