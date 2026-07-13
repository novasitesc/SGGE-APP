/**
 * Re-parsea comprobantes FACTURA_COMPRADOR_* ya cargados (Subasta Platanar)
 * descargando el PDF de Storage y actualizando clasificación + animales.
 *
 *   npx tsx scripts/reparse-platanar.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const appRoot = process.cwd();

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(join(appRoot, ".env.local"));
loadEnv(join(appRoot, ".env"));

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { parseComprobante } from "@/lib/api/pdf/parse-comprobante";
import { classifyComprobante } from "@/lib/api/pdf/classify";

const BUCKET = "comprobantes";

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}`);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre, archivo_path, estado")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .ilike("archivo_nombre", "%FACTURA_COMPRADOR%")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("No hay comprobantes FACTURA_COMPRADOR_* en la bandeja.");
    return;
  }

  console.log(`Re-parseando ${rows.length} comprobante(s)…\n`);

  for (const row of rows) {
    const { data: blob, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(row.archivo_path);

    if (dlErr || !blob) {
      console.log(`✗ ${row.archivo_nombre}: ${dlErr?.message ?? "sin archivo"}`);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const parsed = parseComprobante(buffer, row.archivo_nombre);
    const cls = classifyComprobante(parsed);

    const { error: upErr } = await admin
      .from("comprobantes")
      .update({
        folio_fiscal: parsed.folioFiscal,
        tipo_documento: parsed.tipoDocumento,
        emisor_nombre: parsed.emisorNombre,
        emisor_identificacion: parsed.emisorIdentificacion,
        fecha_emision: parsed.fechaEmision,
        moneda: parsed.moneda,
        monto_total: parsed.montoTotal,
        clasificacion: cls.clasificacion,
        categoria_sugerida: cls.categoriaSugerida,
        confianza: cls.confianza,
        texto_extraido: parsed.texto.slice(0, 20000),
        datos_parseados: { parsed, classification: cls },
      })
      .eq("id", row.id);

    if (upErr) {
      console.log(`✗ ${row.archivo_nombre}: ${upErr.message}`);
      continue;
    }

    const n = parsed.animales?.length ?? 0;
    console.log(
      `✓ ${row.archivo_nombre} → ${cls.clasificacion} (${cls.confianza}%) · ${n} animales · ₡${parsed.montoTotal?.toLocaleString("es-CR") ?? "?"} · ${parsed.pesoTotalKg ?? "?"} kg`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
