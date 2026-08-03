/**
 * Lote 17–24 jul 2026:
 *  1) Gastos de planilla 17/07 (categoría MO)
 *  2) Sube PDFs a comprobantes y confirma en su sección
 *
 *   npx tsx scripts/import-lote-17jul.ts
 *
 * Requiere .env.local con:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

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
loadEnv(join(appRoot, ".env"));

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { uploadComprobante, confirmComprobante } from "@/lib/api/comprobantes";

const DOWNLOADS = "c:/Users/pogba/Downloads";
const PDF_DIR = join(appRoot, "PDF");

/** Planilla 17/07/2026 → categoría MO (mano de obra). */
const PLANILLA: { monto: number; concepto: string }[] = [
  { monto: 128610.58, concepto: "Planilla 17/07/2026 — pago 1" },
  { monto: 76400.86, concepto: "Planilla 17/07/2026 — pago 2" },
  { monto: 87743.28, concepto: "Planilla 17/07/2026 — pago 3" },
  { monto: 68482.56, concepto: "Planilla 17/07/2026 — pago 4" },
  { monto: 15000.0, concepto: "Planilla 17/07/2026 — pago 5" },
];

type FacturaSpec = {
  file: string;
  action: "gasto" | "compra_ganado";
  categoria?: string;
  monto: number;
  fecha: string;
  emisor: string;
  emisorId?: string;
  descripcion: string;
  pesoKg?: number;
};

/**
 * Facturas del lote — montos validados del PDF (o decode CID para Herresal).
 */
const FACTURAS: FacturaSpec[] = [
  {
    file: "50620072600310138336309900001010000040721171239535.pdf",
    action: "gasto",
    categoria: "ALIM",
    monto: 356386.58,
    fecha: "2026-07-20",
    emisor: "Alimentos de Avicultores Integrados AVIN S.A.",
    emisorId: "3101383363",
    descripcion: "Maíz molido + flete (AVIN / engorde)",
  },
  {
    file: "50621072600020364061300100001010000000161180614014.pdf",
    action: "compra_ganado",
    monto: 3052000,
    fecha: "2026-07-21",
    emisor: "Carlos Enrique Herrera Salas",
    emisorId: "203640613",
    descripcion: "Compra 1 ganado en pie (factura 00161)",
    // Peso no viene en la FE; se deja 0 y se ajusta luego si hace falta
    pesoKg: 0,
  },
  {
    file: "50620072600310200722302600003010000005861100000000.pdf",
    action: "gasto",
    categoria: "ALIM",
    monto: 7357,
    fecha: "2026-07-20",
    emisor: "Corporación Super Mercados Unidos SRL",
    emisorId: "3102007223",
    descripcion: "Súper (víveres) — ₡7.357",
  },
  {
    file: "50624072600310153393300100001010000000375100008081.pdf",
    action: "gasto",
    categoria: "TRANS",
    monto: 940500,
    fecha: "2026-07-24",
    emisor: "Seis Hermanos Herresal S.A.",
    emisorId: "3101533933",
    descripcion: "Transporte / flete ganado (FE 00000375)",
  },
  {
    file: "003004045002-FC-51600001010000402995.PDF",
    action: "gasto",
    categoria: "ALIM",
    monto: 47614.29,
    fecha: "2026-07-21",
    emisor: "Cooperativa de Productores de Leche Dos Pinos R.L.",
    emisorId: "3004045002",
    descripcion: "REVALOR H — Dos Pinos (FC-516…402995)",
  },
  {
    file: "003004045002-FC-51600001010000402769.PDF",
    action: "gasto",
    categoria: "VET",
    monto: 42925.67,
    fecha: "2026-07-20",
    emisor: "Cooperativa de Productores de Leche Dos Pinos R.L.",
    emisorId: "3004045002",
    descripcion:
      "Sal ganadera + Virba + Matagusanos + Partovet + Cidental (FC-516…402769)",
  },
  {
    file: "50620072600310119718700100001010000797737100000000.pdf",
    action: "gasto",
    categoria: "COMB",
    monto: 22536,
    fecha: "2026-07-20",
    emisor: "Estación de Servicio Muelle",
    emisorId: "3101197187",
    descripcion: "Diésel / combustible — Estación Muelle",
  },
  {
    file: "50620072600310174718400200001010000123873111821357.pdf",
    action: "gasto",
    categoria: "MANT",
    monto: 22050,
    fecha: "2026-07-20",
    emisor: "Materiales El Contenedor",
    emisorId: "3101747184",
    descripcion: "Cemento Holcim 50 kg × 3",
  },
  {
    file: "003101211148-FE-00400015010000000644.pdf",
    action: "gasto",
    categoria: "ALIM",
    monto: 2712,
    fecha: "2026-07-20",
    emisor: "Inversiones OSO / Tilapia",
    emisorId: "3101211148",
    descripcion: "Filet de tilapia (FE-004…00644)",
  },
];

async function ensurePlanilla(
  admin: ReturnType<typeof createSupabaseAdmin>,
  granjaId: string
) {
  const { data: cat, error: eCat } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", "MO")
    .maybeSingle();
  if (eCat) throw new Error(eCat.message);
  if (!cat) throw new Error("No existe categoría MO (mano de obra)");

  let created = 0;
  let skipped = 0;

  for (const p of PLANILLA) {
    const { data: existing } = await admin
      .from("gastos")
      .select("id")
      .eq("granja_id", granjaId)
      .eq("fecha", "2026-07-17")
      .eq("monto", p.monto)
      .eq("categoria_id", cat.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      console.log(`  · planilla ya existe ₡${p.monto.toLocaleString("es-CR")}`);
      skipped++;
      continue;
    }

    const { error } = await admin.from("gastos").insert({
      granja_id: granjaId,
      categoria_id: cat.id,
      fecha: "2026-07-17",
      concepto: p.concepto,
      monto: p.monto,
      referencia: "PLANILLA-2026-07-17",
    });
    if (error) {
      console.log(`  ✗ planilla ₡${p.monto}: ${error.message}`);
    } else {
      console.log(`  ✓ MO ₡${p.monto.toLocaleString("es-CR")} — ${p.concepto}`);
      created++;
    }
  }

  const total = PLANILLA.reduce((s, p) => s + p.monto, 0);
  console.log(
    `Planilla: +${created} nuevos, ${skipped} existentes · Total ₡${total.toLocaleString("es-CR")}\n`
  );
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "✗ Falta .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.\n" +
        "  Restaura el archivo y vuelve a correr: npx tsx scripts/import-lote-17jul.ts"
    );
    process.exit(2);
  }

  if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true });

  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}\n=== Planilla 17/07/2026 ===`);
  await ensurePlanilla(admin, granjaId);

  console.log("=== Facturas → comprobantes + secciones ===");
  let ok = 0;
  let fail = 0;
  let dup = 0;

  for (const spec of FACTURAS) {
    const src = join(DOWNLOADS, spec.file);
    if (!existsSync(src)) {
      console.log(`✗ no encontrado: ${spec.file}`);
      fail++;
      continue;
    }

    const dest = join(PDF_DIR, basename(spec.file));
    copyFileSync(src, dest);
    const buffer = readFileSync(src);

    const up = await uploadComprobante(admin, granjaId, {
      buffer,
      name: basename(spec.file),
      mime: "application/pdf",
    });
    if (!up.ok) {
      console.log(`✗ upload ${spec.file.slice(0, 40)}: ${up.message}`);
      fail++;
      continue;
    }
    if (up.duplicated) {
      console.log(`  · ya en bandeja: ${basename(spec.file).slice(0, 45)}`);
      dup++;
    } else {
      console.log(`  ↑ subido: ${basename(spec.file).slice(0, 45)}`);
    }

    if (up.comprobante.status === "confirmado") {
      console.log(`  · ya confirmado — omitido`);
      ok++;
      continue;
    }

    if (spec.action === "compra_ganado") {
      const res = await confirmComprobante(admin, granjaId, up.comprobante.id, {
        classification: "compra_ganado",
        issuer: spec.emisor,
        issuerId: spec.emisorId,
        issueDate: spec.fecha,
        amount: spec.monto,
        totalWeightKg: spec.pesoKg && spec.pesoKg > 0 ? spec.pesoKg : null,
        tipoAdquisicion: "particular",
        description: spec.descripcion,
      });
      if (res.ok) {
        console.log(
          `  ✓ COMPRA ₡${spec.monto.toLocaleString("es-CR")} — ${spec.emisor}`
        );
        ok++;
      } else {
        console.log(`  ✗ compra: ${res.message}`);
        fail++;
      }
      continue;
    }

    const res = await confirmComprobante(admin, granjaId, up.comprobante.id, {
      classification: "gasto",
      issuer: spec.emisor,
      issuerId: spec.emisorId,
      issueDate: spec.fecha,
      amount: spec.monto,
      categoryCode: spec.categoria!,
      description: spec.descripcion,
    });
    if (res.ok) {
      console.log(
        `  ✓ ${spec.categoria} ₡${spec.monto.toLocaleString("es-CR")} — ${spec.emisor}`
      );
      ok++;
    } else {
      console.log(`  ✗ gasto: ${res.message}`);
      fail++;
    }
  }

  // Registrar Carlos Herrera en emisores conocidos vía update de archivo (ya hardcodeado arriba)

  const { count: nPend } = await admin
    .from("comprobantes")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .eq("estado", "pendiente")
    .is("deleted_at", null);

  console.log("\n=== Resumen ===");
  console.log(`  Facturas OK: ${ok} · fallidas: ${fail} · duplicadas upload: ${dup}`);
  console.log(`  Pendientes restantes en bandeja: ${nPend}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
