import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { looksLikeCidGarbage, extractPdfText } from "../lib/api/pdf/extract-text";

async function main() {
  const f = "PDF/50629062600310138336309900001010000039116109137559.pdf";
  const buf = readFileSync(f);
  const light = extractPdfText(buf);
  console.log("light garbage?", looksLikeCidGarbage(light), "len", light.length);
  console.log("light head", light.slice(0, 120).replace(/\n/g, " "));

  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const t = typeof text === "string" ? text : text.join("\n");
  console.log("unpdf pages", totalPages, "len", t.length);
  console.log("unpdf sample:\n", t.slice(0, 500));
  console.log("TOTAL?", t.match(/TOTAL COMPROBANTE[^\n]*/i)?.[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
