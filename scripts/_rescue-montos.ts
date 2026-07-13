/**
 * Intenta rescatar montos de PDFs locales que quedaron sin monto.
 *   npx tsx scripts/_rescue-montos.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "../lib/api/pdf/extract-text";
import { normalizeSpacedPdfText } from "../lib/api/pdf/normalize-spaced";
import { parseCrNumber } from "../lib/api/pdf/cr-number";

const folder = join(process.cwd(), "PDF");
const targets = [
  "003004045002-FC-51100001010000294393.PDF",
  "50606072600310138336309900001010000039664159698705.pdf",
  "50606072600310296585600100001010000000004118350711.pdf",
  "50615062600310200722302600003010000005663100000000.pdf",
  "50622062600310119718700100001010000790561100000000.pdf",
  "Factura Electrónica N° 3101546580-FE-00200001010000000148.pdf",
];

function findTotals(text: string): number[] {
  const found: number[] = [];
  const patterns = [
    /Total(?:General|Comprobante|Factura|CRC)?\s*:?\s*[¢₡$]?\s*([\d.,]{3,20})/gi,
    /TOTAL\s*[:=]?\s*[¢₡$]?\s*([\d.,]{3,20})/gi,
    /Importe\s*(?:total)?\s*:?\s*[¢₡$]?\s*([\d.,]{3,20})/gi,
    /Monto\s*(?:total)?\s*:?\s*[¢₡$]?\s*([\d.,]{3,20})/gi,
    /Grand\s*Total\s*:?\s*[¢₡$]?\s*([\d.,]{3,20})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseCrNumber(m[1]);
      if (n != null && n >= 100 && n < 50_000_000) found.push(n);
    }
  }
  // Compact form TOTAL1,234.56
  const compact = text.replace(/\s+/g, "");
  for (const m of compact.matchAll(/TOTAL(?:GENERAL)?([\d,]+\.\d{2})/gi)) {
    const n = parseCrNumber(m[1]);
    if (n != null && n >= 100 && n < 50_000_000) found.push(n);
  }
  return [...new Set(found)].sort((a, b) => b - a);
}

for (const f of targets) {
  const path = join(folder, f);
  if (!existsSync(path)) {
    console.log("MISSING", f);
    continue;
  }
  const raw = extractPdfText(readFileSync(path));
  const norm = normalizeSpacedPdfText(raw);
  const totals = findTotals(norm.length > 50 ? norm : raw);
  console.log("---", f.slice(0, 60));
  console.log("  rawLen", raw.length, "normLen", norm.length, "totals", totals.slice(0, 5));
  console.log("  sample:", (norm || raw).replace(/\s+/g, " ").slice(0, 200));
}
