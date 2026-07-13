/**
 * Prueba César -3/-5..+5 para Super y Macho; busca montos en letras y números.
 *   npx tsx scripts/_probe-cesar.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "../lib/api/pdf/extract-text";

function cesar(input: string, shift: number): string {
  return input.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

const files = [
  "50615062600310200722302600003010000005663100000000.pdf",
  "50606072600310296585600100001010000000004118350711.pdf",
  "003101211148-FE-00400015010000000574.pdf",
];

const milWords =
  /(CERO|UN|UNA|DOS|TRES|CUATRO|CINCO|SEIS|SIETE|OCHO|NUEVE|DIEZ|ONCE|DOCE|TRECE|CATORCE|QUINCE|DIECISEIS|DIECISIETE|DIECIOCHO|DIECINUEVE|VEINTE|VEINTI\w+|TREINTA|CUARENTA|CINCUENTA|SESENTA|SETENTA|OCHENTA|NOVENTA|CIEN|CIENTO|DOSCIENTOS|TRESCIENTOS|CUATROCIENTOS|QUINIENTOS|SEISCIENTOS|SETECIENTOS|OCHOCIENTOS|NOVECIENTOS|MIL|MILLON|MILLONES|COLON|COLONES|EXACTOS?)/gi;

for (const f of files) {
  const text = extractPdfText(readFileSync(join("PDF", f)));
  console.log("\n########", f.slice(0, 45));
  for (let s = -5; s <= 5; s++) {
    const t = (s === 0 ? text : cesar(text, s)).toUpperCase();
    const idx = t.search(/VALOR\s*EN\s*LETRAS|TOTAL\s*A\s*PAGAR|IMPORTE\s*TOTAL|DIECINUEVE|SIETE\s*MIL|TRESMIL|TRES\s*MIL/);
    const milHits = t.match(new RegExp(`(?:${milWords.source}\\s*){3,12}`, "gi"));
    if (idx >= 0 || (milHits && milHits.length)) {
      console.log(` shift ${s}: idx=${idx}`);
      if (idx >= 0) console.log("  near:", t.slice(Math.max(0, idx - 20), idx + 120).replace(/\s+/g, " "));
      if (milHits) console.log("  mils:", milHits.slice(0, 5).map((x) => x.replace(/\s+/g, " ").slice(0, 80)));
    }
    // Also look for colon amounts after TOTAL
    const compact = t.replace(/\s+/g, "");
    const tot = [...compact.matchAll(/TOTAL[A-Z]*([\d,]+\.\d{2})/g)].map((m) => m[1]);
    const nums = [...compact.matchAll(/[\d,]+\.\d{2}/g)].map((m) => m[0]).slice(0, 8);
    if (tot.length || (s === -3 && nums.length)) {
      console.log(` shift ${s} totals:`, tot, "nums:", nums);
    }
  }
  // Try digit→letter weird maps from font: also scan raw for spaced digits
  const spacedDigits = text.match(/(?:\d\s*){4,}/g)?.slice(0, 5);
  console.log(" spaced digit runs:", spacedDigits);
}
