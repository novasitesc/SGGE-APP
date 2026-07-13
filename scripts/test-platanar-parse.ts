/**
 * Prueba rápida del parser Platanar sobre los PDF locales.
 *   npx tsx scripts/test-platanar-parse.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseComprobante } from "../lib/api/pdf/parse-comprobante";
import { classifyComprobante } from "../lib/api/pdf/classify";

const folder = join(process.cwd(), "PDF");
const files = [
  "FACTURA_COMPRADOR_00042933.pdf",
  "FACTURA_COMPRADOR_00043129 (1).pdf",
  "FACTURA_COMPRADOR_00043297 (1).pdf",
  "FACTURA_COMPRADOR_00043497.pdf",
];

for (const f of files) {
  const path = join(folder, f);
  if (!existsSync(path)) {
    console.log("MISSING", f);
    continue;
  }
  const t0 = Date.now();
  const p = parseComprobante(readFileSync(path), f);
  const c = classifyComprobante(p);
  console.log("---", f, `(${Date.now() - t0}ms)`);
  console.log(
    "origen:",
    p.origenParser,
    "| folio:",
    p.folioFiscal,
    "| fecha:",
    p.fechaEmision
  );
  console.log("emisor:", p.emisorNombre, p.emisorIdentificacion);
  console.log(
    "monto:",
    p.montoTotal,
    "| peso:",
    p.pesoTotalKg,
    "| animales:",
    p.animales?.length ?? 0
  );
  console.log("class:", c.clasificacion, c.confianza, "-", c.motivo);
  for (const a of p.animales ?? []) {
    console.log(
      `  NO${a.codigo} ${a.tipo} ${a.color} ${a.pesoKg}kg @ ${a.precioKg} = ${a.monto} | ${a.vendedor}`
    );
  }
}
