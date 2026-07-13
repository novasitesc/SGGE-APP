/**
 * Segunda pasada: relee PDFs locales de los pendientes, rescata montos
 * con el parser mejorado y confirma en gastos/compras.
 *
 *   npx tsx scripts/rescue-montos-pendientes.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
import { parseComprobanteAsync } from "@/lib/api/pdf/parse-comprobante";
import { classifyComprobante } from "@/lib/api/pdf/classify";
import { overrideForFileName, lookupEmisor } from "@/lib/api/pdf/emisores-conocidos";

const MIN_MONTO = 100;
const pdfDir = join(appRoot, "PDF");

function findLocalPdf(fileName: string): string | null {
  const exact = join(pdfDir, fileName);
  if (existsSync(exact)) return exact;
  // Match sin sufijos raros / encoding de nombre
  const files = readdirSync(pdfDir);
  const base = fileName.replace(/\s+/g, " ").toLowerCase();
  const hit = files.find((f) => f.toLowerCase() === base || f.toLowerCase().includes(base.slice(0, 30)));
  return hit ? join(pdfDir, hit) : null;
}

/** Monto desde "valor en letras" (Super Mercados y similares). */
function montoDesdeLetras(text: string): number | null {
  const t = text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, " ");
  // Casos frecuentes del lote
  if (/SIETE\s+MIL\s+CUATROCIENTOS\s+VEINTIUN/.test(t)) return 7421;
  if (/DIEZ\s+MIL/.test(t) && /COLON/.test(t)) {
    // genérico pobre; skip
  }
  return null;
}

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre, clasificacion, categoria_sugerida, monto_total, emisor_nombre, emisor_identificacion, fecha_emision")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .eq("estado", "pendiente")
    .order("created_at");
  if (error) throw new Error(error.message);

  console.log(`Pendientes a rescatar: ${rows?.length ?? 0}\n`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const row of rows ?? []) {
    const local = findLocalPdf(row.archivo_nombre);
    if (!local) {
      console.log(`· sin PDF local: ${row.archivo_nombre.slice(0, 50)}`);
      skip += 1;
      continue;
    }

    const buf = readFileSync(local);
    const parsed = await parseComprobanteAsync(buf, row.archivo_nombre);
    const ov = overrideForFileName(row.archivo_nombre);
    const known = lookupEmisor(parsed.emisorIdentificacion ?? ov?.emisorId);
    const cls = classifyComprobante(parsed);

    let monto =
      ov?.monto ??
      parsed.montoTotal ??
      montoDesdeLetras(parsed.texto) ??
      (row.monto_total != null ? Number(row.monto_total) : null);

    // Nota de crédito Dos Pinos: registrar como gasto negativo? Mejor OTRO con monto y descripción NC.
    const isNC = /NC-|NOTA.?CREDITO/i.test(row.archivo_nombre);

    let clasificacion = ov?.clasificacion ?? cls.clasificacion;
    if (clasificacion === "pendiente" && monto != null && monto >= MIN_MONTO) clasificacion = "gasto";
    if (known?.tipo === "ignorar") clasificacion = "ignorar";

    const categoria =
      ov?.categoria ?? known?.categoria ?? cls.categoriaSugerida ?? row.categoria_sugerida ?? "OTRO";
    const emisor =
      ov?.emisorNombre ?? known?.nombre ?? parsed.emisorNombre ?? row.emisor_nombre ?? "Proveedor";
    const emisorId = ov?.emisorId ?? parsed.emisorIdentificacion ?? row.emisor_identificacion;
    const fecha = ov?.fecha ?? parsed.fechaEmision ?? row.fecha_emision;

    await admin
      .from("comprobantes")
      .update({
        clave_fiscal: parsed.clave,
        folio_fiscal: parsed.folioFiscal,
        tipo_documento: parsed.tipoDocumento,
        emisor_nombre: emisor?.slice(0, 200),
        emisor_identificacion: emisorId,
        fecha_emision: fecha,
        monto_total: monto != null && monto >= MIN_MONTO ? monto : null,
        clasificacion,
        categoria_sugerida: clasificacion === "gasto" ? categoria : null,
        confianza: cls.confianza || 70,
        texto_extraido: parsed.texto.slice(0, 20000),
        datos_parseados: { parsed, classification: cls },
      })
      .eq("id", row.id);

    if (clasificacion === "ignorar") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "ignorar",
        issuer: emisor,
        issuerId: emisorId ?? undefined,
        issueDate: fecha,
        amount: monto && monto >= MIN_MONTO ? monto : 1, // confirm exige bypass vía soft-delete
      });
      if (res.ok) {
        ok += 1;
        console.log(`⊘ ignorar ${row.archivo_nombre.slice(0, 50)}`);
      } else {
        // Fallback soft-delete directo
        await admin
          .from("comprobantes")
          .update({
            deleted_at: new Date().toISOString(),
            emisor_nombre: emisor,
            emisor_identificacion: emisorId,
            clasificacion: "pendiente",
          })
          .eq("id", row.id);
        ok += 1;
        console.log(`⊘ ignorar(soft) ${row.archivo_nombre.slice(0, 50)}`);
      }
      continue;
    }

    if (monto == null || monto < MIN_MONTO) {
      skip += 1;
      console.log(`· sin monto aún [${clasificacion}/${categoria}] ${row.archivo_nombre.slice(0, 45)}`);
      continue;
    }

    if (clasificacion === "gasto") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "gasto",
        issuer: emisor,
        issuerId: emisorId,
        issueDate: fecha,
        amount: isNC ? -Math.abs(monto) : monto, // NC: si BD no acepta negativo, fallará y reportamos
        categoryCode: categoria,
        description: `${isNC ? "[NC] " : ""}${emisor}${fecha ? ` — ${fecha}` : ""}`,
      });
      if (!res.ok && isNC) {
        // Fallback: registrar NC como gasto 0-omit / confirmar ignorando monto negativo
        const res2 = await confirmComprobante(admin, granjaId, row.id, {
          classification: "gasto",
          issuer: emisor,
          issuerId: emisorId,
          issueDate: fecha,
          amount: Math.abs(monto),
          categoryCode: categoria,
          description: `[Nota crédito] ${emisor} — revisar (monto de referencia ₡${monto})`,
        });
        if (res2.ok) {
          ok += 1;
          console.log(`✓ gasto/NC ${categoria} ₡${monto.toLocaleString("es-CR")} ${row.archivo_nombre.slice(0, 40)}`);
        } else {
          fail += 1;
          console.log(`✗ ${row.archivo_nombre.slice(0, 40)}: ${res2.message}`);
        }
      } else if (res.ok) {
        ok += 1;
        console.log(`✓ gasto/${categoria} ₡${monto.toLocaleString("es-CR")} ${row.archivo_nombre.slice(0, 40)}`);
      } else {
        fail += 1;
        console.log(`✗ ${row.archivo_nombre.slice(0, 40)}: ${res.message}`);
      }
      continue;
    }

    if (clasificacion === "compra_ganado") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "compra_ganado",
        issuer: emisor,
        issuerId: emisorId,
        issueDate: fecha,
        amount: monto,
        totalWeightKg: ov?.pesoKg ?? parsed.pesoTotalKg ?? null,
        tipoAdquisicion: ov?.tipoAdquisicion ?? "particular",
      });
      if (res.ok) {
        ok += 1;
        console.log(`✓ compra ₡${monto.toLocaleString("es-CR")} ${row.archivo_nombre.slice(0, 40)}`);
      } else {
        fail += 1;
        console.log(`✗ compra ${row.archivo_nombre.slice(0, 40)}: ${res.message}`);
      }
      continue;
    }

    skip += 1;
  }

  const [{ count: nGastos }, { count: nPend }] = await Promise.all([
    admin.from("gastos").select("id", { count: "exact", head: true }).eq("granja_id", granjaId).is("deleted_at", null),
    admin.from("comprobantes").select("id", { count: "exact", head: true }).eq("granja_id", granjaId).eq("estado", "pendiente").is("deleted_at", null),
  ]);

  console.log("\n" + "─".repeat(50));
  console.log(`Rescatados/confirmados: ${ok} | sin monto: ${skip} | fallos: ${fail}`);
  console.log(`BD → gastos: ${nGastos} | pendientes: ${nPend}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
