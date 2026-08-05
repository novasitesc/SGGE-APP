/**
 * Importa y confirma las facturas del 03-08-2026 (Downloads).
 *
 *   npx tsx scripts/import-facturas-03ago.ts
 *   npx tsx scripts/import-facturas-03ago.ts --confirm
 *
 * Nota: los dos PDFs de Mas x Menos son la misma factura (misma clave);
 * el segundo se registra como duplicado.
 */
import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";

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

const DOWNLOADS = join(
  process.env.USERPROFILE ?? "C:\\Users\\Usuario",
  "Downloads"
);

/** Rutas absolutas de los PDFs a importar. */
const SOURCE_FILES = [
  join(
    DOWNLOADS,
    "50603082600310138336309900001010000041816123160871.pdf"
  ),
  join(
    DOWNLOADS,
    "50603082600310200722302600042010000001609100000000 (1).pdf"
  ),
  join(
    DOWNLOADS,
    "50603082600310200722302600042010000001609100000000 (2).pdf"
  ),
  join(DOWNLOADS, "07400193010000047091_A.pdf"),
  join(DOWNLOADS, "07400193010000047092_A.pdf"),
] as const;

/**
 * Overrides por nombre de archivo (tras normalizar espacios).
 * AVIN: 45 sacos × 46 kg maíz molido.
 */
const OVERRIDES: Record<
  string,
  {
    categoria: string;
    descripcion: string;
    cantidadAlim?: number;
    issuer?: string;
    issuerId?: string;
  }
> = {
  "50603082600310138336309900001010000041816123160871.pdf": {
    categoria: "ALIM",
    descripcion: "Maíz molido 46 kg (45 sacos) + flete — AVIN",
    cantidadAlim: 45 * 46,
    issuer: "Alimentos de Avicultores Integrados AVIN S.A.",
    issuerId: "3101383363",
  },
  "50603082600310200722302600042010000001609100000000 (1).pdf": {
    categoria: "OTRO",
    descripcion: "Compra supermercado (Mas x Menos) — 03/08/2026",
    issuer: "Corporación Super Mercados Unidos SRL",
    issuerId: "3102007223",
  },
  "50603082600310200722302600042010000001609100000000 (2).pdf": {
    categoria: "OTRO",
    descripcion: "Compra supermercado (Mas x Menos) — 03/08/2026",
    issuer: "Corporación Super Mercados Unidos SRL",
    issuerId: "3102007223",
  },
  "07400193010000047091_A.pdf": {
    categoria: "COMB",
    descripcion: "Super 34.37 L — Estación Venecia (Petrodelta)",
    issuer: "Petróleos Delta Costa Rica S.A.",
    issuerId: "3101028782",
  },
  "07400193010000047092_A.pdf": {
    categoria: "COMB",
    descripcion: "Diesel 115.22 L — Estación Venecia (Petrodelta)",
    issuer: "Petróleos Delta Costa Rica S.A.",
    issuerId: "3101028782",
  },
};

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/pdf";
}

/** Nombre estable en Storage/BD (sin ruta). */
function storageName(sourcePath: string): string {
  return basename(sourcePath);
}

async function main() {
  const doConfirm = process.argv.includes("--confirm");
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);

  // Copia a PDF/ del repo para trazabilidad (opcional).
  const pdfDir = join(appRoot, "PDF");
  mkdirSync(pdfDir, { recursive: true });

  console.log(`Granja: ${granjaId}`);
  console.log(`Modo: ${doConfirm ? "IMPORTAR + CONFIRMAR" : "solo IMPORTAR"}\n`);

  let uploaded = 0;
  let dup = 0;
  let confirmed = 0;
  let fail = 0;

  for (const source of SOURCE_FILES) {
    const name = storageName(source);
    if (!existsSync(source)) {
      console.log(`✗ no existe: ${source}`);
      fail++;
      continue;
    }

    const dest = join(pdfDir, name);
    if (!existsSync(dest)) {
      copyFileSync(source, dest);
    }

    const buffer = readFileSync(source);
    const res = await uploadComprobante(admin, granjaId, {
      buffer,
      name,
      mime: mimeFor(name),
    });

    if (!res.ok) {
      console.log(`✗ upload ${name.slice(0, 55)}: ${res.message}`);
      fail++;
      continue;
    }

    if (res.duplicated) {
      dup++;
      console.log(`↺ duplicado (ya en BD): ${name.slice(0, 55)}`);
    } else {
      uploaded++;
      console.log(
        `✓ subido  ${name.slice(0, 50)}  · ₡${res.comprobante.amount?.toLocaleString("es-CR") ?? "—"}  · ${res.comprobante.issuer ?? "?"}`
      );
    }

    if (!doConfirm) continue;

    const ov = OVERRIDES[name];
    const monto =
      res.comprobante.amount != null ? Number(res.comprobante.amount) : null;
    const categoria =
      ov?.categoria ?? res.comprobante.suggestedCategory ?? "OTRO";
    const emisor = ov?.issuer ?? res.comprobante.issuer ?? "Proveedor";
    const emisorId = ov?.issuerId ?? res.comprobante.issuerId ?? null;
    const fecha = res.comprobante.issueDate ?? "2026-08-03";
    const descripcion = ov?.descripcion ?? `Gasto — ${name}`;
    const cantidadAlim = ov?.cantidadAlim;

    if (monto == null || !(monto > 0)) {
      console.log(`  · sin confirmar (falta monto)`);
      continue;
    }

    const { data: row } = await admin
      .from("comprobantes")
      .select("id, estado, gasto_id")
      .eq("granja_id", granjaId)
      .eq("archivo_nombre", name)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si el duplicado se detectó por clave/hash, buscar por clave fiscal.
    let target = row;
    if (!target && res.comprobante.id) {
      const { data: byId } = await admin
        .from("comprobantes")
        .select("id, estado, gasto_id")
        .eq("id", res.comprobante.id)
        .maybeSingle();
      target = byId;
    }

    if (!target) {
      console.log(`  · no encontrado en BD tras upload`);
      fail++;
      continue;
    }
    if (target.estado === "confirmado") {
      console.log(`  · ya confirmado (gasto=${target.gasto_id ?? "—"})`);
      continue;
    }

    const conf = await confirmComprobante(admin, granjaId, target.id, {
      classification: "gasto",
      issuer: emisor,
      issuerId: emisorId,
      issueDate: fecha,
      amount: monto,
      categoryCode: categoria,
      description: descripcion,
      cantidadAlim: cantidadAlim ?? null,
    });

    if (conf.ok) {
      confirmed++;
      console.log(
        `  ✓ gasto ${categoria} ₡${monto.toLocaleString("es-CR")} — ${emisor}`
      );
    } else {
      fail++;
      console.log(`  ✗ confirmar: ${conf.message}`);
    }
  }

  console.log("\n" + "─".repeat(55));
  console.log(
    `Subidos: ${uploaded} | Duplicados: ${dup} | Confirmados: ${confirmed} | Fallos: ${fail}`
  );
  if (!doConfirm) {
    console.log("\nSiguiente: npx tsx scripts/import-facturas-03ago.ts --confirm");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
