/**
 * Prueba unpdf + parse async en facturas AVIN.
 *   npx tsx scripts/_test-avin.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseComprobanteAsync } from "../lib/api/pdf/parse-comprobante";
import { classifyComprobante } from "../lib/api/pdf/classify";
import { overrideForFileName } from "../lib/api/pdf/emisores-conocidos";

async function main() {
  const files = readdirSync("PDF").filter((f) => f.includes("3101383363"));
  for (const f of files) {
    const p = await parseComprobanteAsync(readFileSync(join("PDF", f)), f);
    const cls = classifyComprobante(p);
    const ov = overrideForFileName(f);
    console.log(
      f.slice(0, 45),
      "→ monto",
      p.montoTotal ?? ov?.monto,
      "|",
      (p.emisorNombre ?? ov?.emisorNombre ?? "").slice(0, 40),
      "|",
      cls.clasificacion,
      cls.categoriaSugerida ?? ov?.categoria
    );
    const snip = p.texto.match(/TOTAL COMPROBANTE[^\n]{0,40}|Maiz[^\n]{0,30}|AVIN[^\n]{0,30}/i);
    console.log("  snip:", snip?.[0]?.replace(/\s+/g, " "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
