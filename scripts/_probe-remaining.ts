/**
 * Intenta decodificar pendientes restantes con variantes de fuente.
 *   npx tsx scripts/_probe-remaining.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "../lib/api/pdf/extract-text";
import { decodeCustomPdfText } from "../lib/api/pdf/decode-custom-font";
import { parseComprobante } from "../lib/api/pdf/parse-comprobante";

function cesar(input: string, shift: number): string {
  return input.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

function decodeVariant(input: string, cesarShift: number, plus32: boolean): string {
  let out = "";
  for (const ch of input) {
    let code = ch.charCodeAt(0);
    if (plus32 && code >= 33 && code <= 58) code += 32;
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 + cesarShift + 26) % 26) + 65);
      continue;
    }
    if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 + cesarShift + 26) % 26) + 97);
      continue;
    }
    out += ch;
  }
  return out;
}

const prefixes = [
  "506300626003101533933",
  "DOC-Recepcion",
  "Comprobante639",
  "506010726004000001902",
  "Factura Electr",
  "506060726003101383363",
];

const files = readdirSync("PDF");
for (const pref of prefixes) {
  const hits = files.filter((f) => f.startsWith(pref) || f.toLowerCase().includes(pref.toLowerCase()));
  for (const hit of hits.slice(0, 2)) {
    const buf = readFileSync(join("PDF", hit));
    const raw = extractPdfText(buf);
    const parsed = parseComprobante(buf, hit);
    console.log("\n====", hit.slice(0, 55), "parsed monto", parsed.montoTotal);
    console.log(" raw printable sample:", raw.replace(/[^\x20-\x7E]/g, ".").slice(0, 200));
    for (const shift of [-5, -3, -1, 1, 3, 5]) {
      for (const plus32 of [true, false]) {
        const d = decodeVariant(raw, shift, plus32);
        const u = d.toUpperCase().replace(/[^A-Z]/g, "");
        if (/COLONES|LETRAS|TOTAL|FACTURA|COLONES/.test(u) && /MIL|CIENTO|VEINTI|DIEC/.test(u)) {
          const m = u.match(/[A-Z]{0,20}(?:DIECINUEVE|SIETE|TRES|DIEZ|VEINTE|MIL)[A-Z]{0,40}COLONES/);
          console.log(`  shift=${shift} +32=${plus32}:`, m?.[0] ?? u.match(/VALORENLETRAS[A-Z]{10,50}/)?.[0] ?? u.slice(0, 80));
        }
      }
    }
    // amounts as digits anywhere in buffer
    const latin = buf.toString("latin1");
    const money = [...latin.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)].map((x) => x[1]).slice(0, 15);
    console.log(" buffer money-like:", money.join(" | "));
  }
}
