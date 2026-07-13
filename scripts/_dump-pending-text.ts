/**
 * Diagnóstico: muestra texto/César de PDFs pendientes sin monto.
 *   npx tsx scripts/_dump-pending-text.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "../lib/api/pdf/extract-text";

const pdfDir = join(process.cwd(), "PDF");

function cesar(input: string, shift: number): string {
  return input.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

const prefixes = [
  "506150626003102007223",
  "506060726003102965856",
  "506060726003101383363",
  "506080626003101383363",
  "506150626003101383363",
  "506220626003101383363",
  "506290626003101383363",
  "506060726003102007223",
  "506080626003102007223",
  "506220626003102007223",
  "506290626003102007223",
  "003101211148",
  "506010726004000001902",
  "506300626003101533933",
  "Comprobante639",
  "DOC-Recepcion",
  "Factura Electr",
];

const files = readdirSync(pdfDir);
for (const pref of prefixes) {
  const hit = files.find((f) => f.startsWith(pref) || f.toLowerCase().includes(pref.toLowerCase()));
  if (!hit) {
    console.log("\nMISS", pref);
    continue;
  }
  const text = extractPdfText(readFileSync(join(pdfDir, hit)));
  const compact = text.replace(/\s+/g, "");
  const nums = [...compact.matchAll(/[\d,]+\.\d{2}/g)].map((m) => m[0]).slice(0, 20);
  console.log("\n====", hit.slice(0, 55), "len", text.length);
  console.log("nums:", nums.join(" | "));
  console.log("head:", text.slice(0, 350).replace(/\n/g, "⏎"));
  console.log("cesar+1 head:", cesar(text, 1).slice(0, 350).replace(/\n/g, "⏎"));
  console.log("cesar-1 head:", cesar(text, -1).slice(0, 350).replace(/\n/g, "⏎"));
  // Look for MIL / TOTAL patterns in variants
  for (const [label, t] of [
    ["raw", text],
    ["+1", cesar(text, 1)],
    ["-1", cesar(text, -1)],
  ] as const) {
    const u = t.toUpperCase();
    const mil = u.match(/.{0,20}MIL.{0,40}/g)?.slice(0, 3);
    const tot = u.match(/.{0,10}TOTAL.{0,40}/g)?.slice(0, 3);
    if (mil?.length || tot?.length) {
      console.log(`  [${label}] mil:`, mil?.join(" || "), " tot:", tot?.join(" || "));
    }
  }
}

console.log("\ndone");
