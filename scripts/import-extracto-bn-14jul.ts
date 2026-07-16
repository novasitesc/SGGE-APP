/**
 * Convierte movimientos del extracto BN (capturas sin PDF) en PDFs,
 * los guarda en PDF/, los sube a comprobantes y los confirma como gastos.
 *
 * Fuente: extracto oficina 228, fecha 14/07/2026 — pagos CPLESCA / CHAMBACU.
 *
 *   npx tsx scripts/import-extracto-bn-14jul.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const appRoot = process.cwd();
function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(join(appRoot, ".env.local"));

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { uploadComprobante, confirmComprobante } from "@/lib/api/comprobantes";

type Movimiento = {
  oficina: string;
  fecha: string; // YYYY-MM-DD
  documento: string;
  monto: number;
  entidad: "CPLESCA" | "CHAMBACU";
  referencia: string;
  titular: string;
};

/** Filas del extracto (Salidas) — 14/07/2026, oficina 228. */
const MOVIMIENTOS: Movimiento[] = [
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879730",
    monto: 6658.19,
    entidad: "CPLESCA",
    referencia: "119604",
    titular: "HERMANOS HERRERA PARRALES S",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879726",
    monto: 32648.42,
    entidad: "CPLESCA",
    referencia: "33184",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879725",
    monto: 23806.05,
    entidad: "CHAMBACU",
    referencia: "5671",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879722",
    monto: 10205.0,
    entidad: "CHAMBACU",
    referencia: "5658",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879721",
    monto: 14370.05,
    entidad: "CHAMBACU",
    referencia: "5655",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20879718",
    monto: 109583.28,
    entidad: "CHAMBACU",
    referencia: "5261",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
  {
    oficina: "228",
    fecha: "2026-07-14",
    documento: "20880409",
    monto: 4489.23,
    entidad: "CPLESCA",
    referencia: "87323",
    titular: "HERMANOS HERRERA PARRALES S A",
  },
];

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** PDF mínimo (Helvetica) con los datos del movimiento bancario. */
function buildMovimientoPdf(m: Movimiento): Buffer {
  const fechaUi = m.fecha.split("-").reverse().join("/");
  const montoFmt = m.monto.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const descripcion = `PAGO ${m.entidad} ${m.referencia}/${m.titular}`;

  const lines = [
    "COMPROBANTE DE MOVIMIENTO BANCARIO",
    "Banco Nacional de Costa Rica — Extracto",
    "",
    `Oficina: ${m.oficina}`,
    `Fecha: ${fechaUi}`,
    `Documento: ${m.documento}`,
    `Tipo: Salida (pago)`,
    `Monto: CRC ${montoFmt}`,
    `Entradas: (ninguna)`,
    "",
    `Descripcion: ${descripcion}`,
    `Entidad: ${m.entidad}`,
    `Referencia: ${m.referencia}`,
    `Titular: ${m.titular}`,
    "",
    "Origen: captura de extracto (sin PDF original del banco).",
    "Generado para SGGE — importacion de comprobantes.",
  ];

  const contentParts: string[] = ["BT", "/F1 11 Tf", "50 750 Td", "14 TL"];
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) contentParts.push("/F1 14 Tf");
    if (i === 1) contentParts.push("/F1 11 Tf");
    contentParts.push(`(${pdfEscape(lines[i])}) Tj`, "T*");
  }
  contentParts.push("ET");
  const stream = contentParts.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function fileNameFor(m: Movimiento): string {
  return `BN-EXTRACTO-${m.documento}-${m.entidad}-${m.referencia}.pdf`;
}

function descripcionGasto(m: Movimiento): string {
  return `Pago BN doc ${m.documento} — ${m.entidad} ref ${m.referencia} (oficina ${m.oficina})`;
}

async function main() {
  const pdfDir = join(appRoot, "PDF");
  if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}`);
  console.log(`Movimientos a procesar: ${MOVIMIENTOS.length}\n`);

  let created = 0;
  let confirmed = 0;
  let duplicated = 0;
  let failed = 0;

  for (const m of MOVIMIENTOS) {
    const name = fileNameFor(m);
    const buffer = buildMovimientoPdf(m);
    const localPath = join(pdfDir, name);
    writeFileSync(localPath, buffer);
    console.log(`PDF → ${name}  ₡${m.monto.toLocaleString("es-CR")}`);

    const up = await uploadComprobante(admin, granjaId, {
      buffer,
      name,
      mime: "application/pdf",
    });
    if (!up.ok) {
      console.log(`  ✗ upload: ${up.message}`);
      failed++;
      continue;
    }
    if (up.duplicated) {
      console.log(`  · ya existía (hash/clave) id=${up.comprobante.id}`);
      duplicated++;
    } else {
      console.log(`  ↑ subido id=${up.comprobante.id}`);
      created++;
    }

    if (up.comprobante.status === "confirmado") {
      console.log(`  · ya confirmado`);
      confirmed++;
      continue;
    }

    const res = await confirmComprobante(admin, granjaId, up.comprobante.id, {
      classification: "gasto",
      issuer: m.entidad,
      issueDate: m.fecha,
      amount: m.monto,
      categoryCode: "OTRO",
      description: descripcionGasto(m),
    });
    if (res.ok) {
      console.log(`  ✓ gasto OTRO confirmado`);
      confirmed++;
    } else {
      console.log(`  ✗ confirm: ${res.message}`);
      failed++;
    }
  }

  const total = MOVIMIENTOS.reduce((s, m) => s + m.monto, 0);
  console.log("\n=== Resumen lote extracto 14/07/2026 ===");
  console.log(`  PDFs escritos: ${MOVIMIENTOS.length}`);
  console.log(`  Nuevos en BD:  ${created}`);
  console.log(`  Duplicados:    ${duplicated}`);
  console.log(`  Confirmados:   ${confirmed}`);
  console.log(`  Fallidos:      ${failed}`);
  console.log(`  Total salidas: ₡${total.toLocaleString("es-CR")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
