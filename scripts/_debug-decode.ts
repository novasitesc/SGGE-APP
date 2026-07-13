import { readFileSync } from "node:fs";
import { extractPdfText } from "../lib/api/pdf/extract-text";
import { decodeCustomPdfText } from "../lib/api/pdf/decode-custom-font";

const files = [
  "PDF/50615062600310200722302600003010000005663100000000.pdf",
  "PDF/50606072600310296585600100001010000000004118350711.pdf",
  "PDF/003101211148-FE-00400015010000000574.pdf",
];
for (const f of files) {
  const raw = extractPdfText(readFileSync(f));
  const d = decodeCustomPdfText(raw);
  console.log("\n##", f.slice(4, 55));
  const u = d.toUpperCase();
  for (const w of ["DIECINUEVE", "SIETE", "TRES MIL", "TRESMIL", "VEINTI", "CUATROCIENTOS", "COLONES", "LETRAS", "TOTAL"]) {
    const i = u.indexOf(w);
    if (i >= 0) console.log(w, "→", u.slice(i, i + 90).replace(/\s+/g, " "));
  }
  const letters = d.replace(/[^A-Za-z]/g, "").toUpperCase();
  // Search amount-like substrings in compacted letters
  for (const w of ["DIECINUEVEMIL", "SIETEMIL", "TRESMIL", "VALORENLETRAS", "CUATROCIENTOS"]) {
    const i = letters.indexOf(w);
    if (i >= 0) console.log("compact", w, "→", letters.slice(i, i + 80));
  }
}
