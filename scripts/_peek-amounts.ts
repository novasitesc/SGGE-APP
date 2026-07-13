import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "../lib/api/pdf/extract-text";
import { normalizeSpacedPdfText } from "../lib/api/pdf/normalize-spaced";

const files = [
  "003004045002-FC-51100001010000294393.PDF",
  "50622062600310119718700100001010000790561100000000.pdf",
  "50615062600310200722302600003010000005663100000000.pdf",
  "50606072600310296585600100001010000000004118350711.pdf",
];

for (const f of files) {
  const raw = extractPdfText(readFileSync(join(process.cwd(), "PDF", f)));
  const norm = normalizeSpacedPdfText(raw);
  const nums = [...norm.matchAll(/[\d,]+\.\d{2}/g)].map((m) => m[0]);
  console.log("=".repeat(60));
  console.log(f);
  console.log(norm.slice(0, 1800));
  console.log("NUMS:", nums.slice(0, 30).join(" | "));
}
