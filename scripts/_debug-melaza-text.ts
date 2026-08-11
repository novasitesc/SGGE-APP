import fs from "fs";
import path from "path";
import { extractCantidadAlimentoFromText } from "../lib/api/alim-from-comprobante";
import { extractPdfTextAsync } from "../lib/api/pdf/extract-text";

async function rest<T>(p: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(`${base}/rest/v1/${p}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return JSON.parse(t) as T;
}

async function main() {
  const dir = path.join(process.cwd(), "PDF");
  console.log("PDF dir exists?", fs.existsSync(dir));
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => /003004045002/i.test(f));
    console.log("local matches:", files);
  }

  const name = "003004045002-FC-51100001010000294393.PDF";
  const comps = await rest<
    {
      archivo_nombre: string | null;
      archivo_path: string | null;
      texto_extraido: string | null;
      monto_total: number | null;
    }[]
  >(
    `comprobantes?archivo_nombre=eq.${encodeURIComponent(name)}&select=archivo_nombre,archivo_path,texto_extraido,monto_total`
  );
  const c = comps[0];
  console.log("db row?", !!c, "path=", c?.archivo_path);
  console.log("texto_extraido len", c?.texto_extraido?.length ?? 0);
  console.log("texto sample:", (c?.texto_extraido ?? "").slice(0, 300));
  console.log(
    "from db extract:",
    extractCantidadAlimentoFromText(c?.texto_extraido ?? "", c?.monto_total)
  );

  const local = path.join(dir, name);
  console.log("local exists?", fs.existsSync(local));
  if (fs.existsSync(local)) {
    const text = await extractPdfTextAsync(fs.readFileSync(local));
    console.log("local text len", text.length);
    console.log("local sample:", text.slice(0, 400));
    console.log(
      "from local extract:",
      extractCantidadAlimentoFromText(text, 1324310.79)
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
