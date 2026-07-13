/**
 * Carga masiva de comprobantes (PDFs) a Supabase.
 *
 * Reutiliza la misma lógica del flujo web (parseo → clasificación → Storage →
 * tabla `comprobantes`, con deduplicación por clave fiscal y hash).
 *
 * Uso:
 *   npx tsx scripts/import-comprobantes.ts [carpeta]
 *   npm run import:comprobantes
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (opcional) SRRG_DEFAULT_GRANJA_ID / SGGE_DEFAULT_FARM_ID
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, extname } from "node:path";

// ── Cargar variables de entorno desde .env.local (antes de usar el cliente) ──
const appRoot = process.cwd();

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(join(appRoot, ".env.local"));
loadEnv(join(appRoot, ".env"));

// Los módulos leen el entorno de forma perezosa (dentro de funciones),
// por lo que es seguro importarlos estáticamente tras cargar env.
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { uploadComprobante } from "@/lib/api/comprobantes";

const BUCKET = "comprobantes";
const IMAGE_OR_PDF = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/pdf";
}

async function ensureBucket(admin: ReturnType<typeof createSupabaseAdmin>) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`No se pudo crear el bucket '${BUCKET}': ${error.message}`);
  }
}

async function main() {
  const folderArg = process.argv[2];
  const folder = folderArg ? resolve(folderArg) : join(appRoot, "PDF");

  if (!existsSync(folder)) {
    console.error(`✗ Carpeta no encontrada: ${folder}`);
    process.exit(1);
  }

  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}`);

  // 1) Verificar que la tabla exista.
  const probe = await admin.from("comprobantes").select("id").limit(1);
  const tableMissing =
    probe.error &&
    (probe.error.code === "42P01" ||
      probe.error.code === "PGRST205" ||
      /schema cache|could not find the table/i.test(probe.error.message));
  if (tableMissing) {
    console.error(
      "\n✗ La tabla 'comprobantes' no existe todavía.\n" +
        "  Ejecuta UNA sola vez en Supabase → SQL Editor:\n" +
        "    docs/database/comprobantes-modulo.sql\n" +
        "  y vuelve a correr:  npm run import:comprobantes\n"
    );
    process.exit(2);
  }

  // 2) Asegurar bucket.
  await ensureBucket(admin);

  // 3) Recorrer archivos.
  const files = readdirSync(folder)
    .filter((f) => IMAGE_OR_PDF.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  console.log(`Archivos a procesar: ${files.length}\n`);

  let ok = 0;
  let dup = 0;
  let fail = 0;
  const compra: string[] = [];
  const gasto: string[] = [];
  const pendiente: string[] = [];

  for (const name of files) {
    const buffer = readFileSync(join(folder, name));
    try {
      const res = await uploadComprobante(admin, granjaId, {
        buffer,
        name,
        mime: mimeFor(name),
      });
      if (!res.ok) {
        fail++;
        console.log(`  ✗ ${name} — ${res.message}`);
        continue;
      }
      const c = res.comprobante;
      if (res.duplicated) {
        dup++;
        console.log(`  ↺ ${name} — duplicado (omitido)`);
      } else {
        ok++;
        const cls =
          c.classification === "compra_ganado"
            ? "GANADO"
            : c.classification === "gasto"
              ? `GASTO/${c.suggestedCategory ?? "?"}`
              : "PENDIENTE";
        const monto = c.amount != null ? `₡${c.amount.toLocaleString("es-CR")}` : "—";
        console.log(`  ✓ ${name} — ${cls} · ${monto} · ${c.issuer ?? "sin emisor"}`);
      }
      if (c.classification === "compra_ganado") compra.push(name);
      else if (c.classification === "gasto") gasto.push(name);
      else pendiente.push(name);
    } catch (e) {
      fail++;
      console.log(`  ✗ ${name} — ${e instanceof Error ? e.message : "error"}`);
    }
  }

  console.log("\n──────── Resumen ────────");
  console.log(`  Subidos:      ${ok}`);
  console.log(`  Duplicados:   ${dup}`);
  console.log(`  Con error:    ${fail}`);
  console.log(`  ─ Compra ganado: ${compra.length}`);
  console.log(`  ─ Gasto:         ${gasto.length}`);
  console.log(`  ─ Sin clasificar:${pendiente.length}`);
  console.log(
    "\nRevisa y confirma cada uno en: Gestión → Comprobantes (estado 'pendiente')."
  );
}

main().catch((e) => {
  console.error("Error fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
