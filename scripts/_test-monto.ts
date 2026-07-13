import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseComprobante } from "../lib/api/pdf/parse-comprobante";
import { decodeCustomPdfText } from "../lib/api/pdf/decode-custom-font";
import { extractPdfText } from "../lib/api/pdf/extract-text";

const files = [
  "50622062600310119718700100001010000790561100000000.pdf",
  "50615062600310200722302600003010000005663100000000.pdf",
  "50606072600310296585600100001010000000004118350711.pdf",
  "003101211148-FE-00400015010000000574.pdf",
  "50606072600310200722302600042010000001542100000000.pdf",
];
for (const f of files) {
  try {
    const buf = readFileSync(join("PDF", f));
    const p = parseComprobante(buf, f);
    console.log(f.slice(0, 48), "→ monto", p.montoTotal, "|", (p.emisorNombre ?? "").slice(0, 40));
    if (p.montoTotal == null) {
      const raw = extractPdfText(buf);
      const d = decodeCustomPdfText(raw);
      const hit = d.toUpperCase().match(/VALOR EN LETRAS.{0,80}|DIECINUEVE.{0,40}|SIETE MIL.{0,40}|TRES MIL.{0,50}/);
      console.log("  decoded hint:", hit?.[0]?.replace(/\s+/g, " "));
    }
  } catch (e) {
    console.log("FAIL", f, e);
  }
}
