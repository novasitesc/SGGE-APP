/**
 * Investiga PDFs locales de compras ALIM y corrige:
 * - kg reales (melaza, grofactor, maíz AVIN)
 * - quita de feeding facturas Dos Pinos que NO son alimento (vet/cerca/batería)
 * - reclasifica gasto (VET / MANT) cuando aplique
 *
 *   npx tsx --env-file=.env.local scripts/corregir-compras-desde-pdf.ts
 *   npx tsx --env-file=.env.local scripts/corregir-compras-desde-pdf.ts --apply
 */
import fs from "fs";
import path from "path";
import {
  extractCantidadAlimentoFromText,
  parseCantidadNumero,
} from "../lib/api/alim-from-comprobante";
import { extractPdfTextAsync } from "../lib/api/pdf/extract-text";

const APPLY = process.argv.includes("--apply");

async function rest<T = unknown>(
  pathUrl: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(`${base}/rest/v1/${pathUrl}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "return=representation",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${pathUrl}: ${t}`);
  return (t ? JSON.parse(t) : []) as T;
}

function findLocalPdf(fileName: string): string | null {
  if (!fileName) return null;
  const dir = path.join(process.cwd(), "PDF");
  const target = fileName.toLowerCase();
  const files = fs.readdirSync(dir);
  const hit =
    files.find((f) => f.toLowerCase() === target) ||
    files.find((f) =>
      f.toLowerCase().includes(target.replace(/\.pdf$/i, "").toLowerCase())
    );
  return hit ? path.join(dir, hit) : null;
}

function parseDosPinosDescripciones(texto: string): string[] {
  const compact = texto.replace(/\s+/g, " ");
  const m = compact.match(
    /C[oó]digo\s+Descripci[oó]n\s+Precio\s+Un\.\s+Total\s+Cant\.\s+(.+?)\s+SUBTOTAL:/i
  );
  if (!m) return [];
  const re = /(\d{7,8})\s*-\s*(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s+[EWXZY]/gi;
  const out: string[] = [];
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(m[1])) !== null) out.push(hit[2].trim());
  return out;
}

function clasificarNoAlim(descs: string[]): "VET" | "MANT" | "OTRO" {
  const blob = descs.join(" ").toUpperCase();
  if (
    /BAYTRIL|REVALOR|VIRBAMEC|ABAXTION|DORAMEC|HISTAMINEX|PARTOVET|MULTIFORT|ABZ\b|CARBOLINA|COSMO/.test(
      blob
    )
  ) {
    return "VET";
  }
  if (
    /ALAMBRE|AISLADOR|CLAVO|GRAPA|ALICATE|BATERIA|UNION\s*LISA|TIJERA|PVC/.test(
      blob
    )
  ) {
    return "MANT";
  }
  return "OTRO";
}

async function ensureAlimento(opts: {
  granjaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
}): Promise<string> {
  const aliases =
    opts.codigo === "MAIZ-AVIN"
      ? ["MAIZ-AVIN", "CON-ENG"]
      : opts.codigo === "GRO-DP"
        ? ["GRO-DP", "CON-ENG"]
        : [opts.codigo];

  for (const codigo of aliases) {
    const existing = await rest<{ id: string }[]>(
      `alimentos?granja_id=eq.${opts.granjaId}&codigo=eq.${codigo}&select=id&limit=1`
    );
    if (existing[0]?.id) return existing[0].id;
  }

  const byName = await rest<{ id: string; nombre: string }[]>(
    `alimentos?granja_id=eq.${opts.granjaId}&select=id,nombre,codigo&limit=100`
  );
  const needle =
    opts.codigo === "MAIZ-AVIN"
      ? /ma[ií]z|concentrado\s*engorda/i
      : opts.codigo === "GRO-DP"
        ? /grofactor/i
        : new RegExp(opts.nombre.split(/\s+/)[0], "i");
  const hit = byName.find((a) => needle.test(a.nombre));
  if (hit?.id) return hit.id;

  const inserted = await rest<{ id: string }[]>("alimentos", {
    method: "POST",
    body: JSON.stringify({
      granja_id: opts.granjaId,
      codigo: opts.codigo,
      nombre: opts.nombre,
      tipo: opts.tipo,
      unidad_medida: "kg",
      costo_unitario: 0,
      activo: true,
    }),
  });
  return inserted[0].id;
}

async function main() {
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - 120);
  const desdeIso = desde.toISOString().slice(0, 10);

  const cabs = await rest<
    {
      id: string;
      fecha: string;
      observaciones: string | null;
      granja_id: string;
      costo_total: number | null;
    }[]
  >(
    `alimentaciones?turno=eq.compra&deleted_at=is.null&fecha=gte.${desdeIso}&select=id,fecha,observaciones,granja_id,costo_total&order=fecha.desc`
  );

  type Det = {
    id: string;
    alimentacion_id: string;
    alimento_id: string;
    cantidad: number;
    subtotal: number;
    alimentos: { nombre: string; codigo: string | null } | null;
  };

  const dets: Det[] = [];
  for (let i = 0; i < cabs.length; i += 40) {
    const ids = cabs.slice(i, i + 40).map((c) => c.id);
    if (!ids.length) continue;
    dets.push(
      ...(await rest<Det[]>(
        `detalle_alimentaciones?alimentacion_id=in.(${ids.join(",")})&select=id,alimentacion_id,alimento_id,cantidad,subtotal,alimentos(nombre,codigo)`
      ))
    );
  }

  let updatedKg = 0;
  let removed = 0;
  let skipped = 0;
  let reclass = 0;

  console.log(`\nCompras a revisar: ${dets.length} (desde ${desdeIso})\n`);

  for (const d of dets) {
    const cab = cabs.find((c) => c.id === d.alimentacion_id)!;
    const qty = Number(d.cantidad) || 0;
    const cost = Number(d.subtotal) || 0;
    const unit = qty > 0 ? cost / qty : 0;
    const needsWork = qty <= 1.0001 || unit > 5000 || /melaz/i.test(d.alimentos?.nombre ?? "");
    const gastoId =
      cab.observaciones?.match(/gasto:([0-9a-f-]{36})/i)?.[1] ?? null;

    let archivo = "";
    if (gastoId) {
      const comps = await rest<{ archivo_nombre: string | null }[]>(
        `comprobantes?gasto_id=eq.${gastoId}&select=archivo_nombre`
      );
      archivo = comps[0]?.archivo_nombre ?? "";
    }
    const local = archivo ? findLocalPdf(archivo) : null;
    const label = `${cab.fecha} | ${d.alimentos?.nombre} | ₡${cost.toLocaleString("es-CR")} | qty=${qty} | ${archivo || "sin PDF"}`;

    if (!local) {
      if (needsWork) {
        console.log(`⊘ sin PDF local: ${label}`);
        skipped++;
      }
      continue;
    }

    const text = await extractPdfTextAsync(fs.readFileSync(local));
    const descs = parseDosPinosDescripciones(text);
    const isDosPinos = /003004045002|DOS\s*PINOS/i.test(archivo + text.slice(0, 200));
    const isAvin = /3101383363|AVIN|Ma[ií]z\s*Molido/i.test(archivo + text);
    const hasMelaza = /MELAZA\s*KG|MELAZAKG/i.test(text);
    const hasGrofactor = /GROFACTOR/i.test(text);
    const isNC = /NC-|NOTA.?CREDITO/i.test(archivo);
    const isSuper =
      /3102007223|Super\s*Mercados|Walmart|SUP-ALIM/i.test(
        `${archivo} ${d.alimentos?.codigo ?? ""} ${d.alimentos?.nombre ?? ""}`
      ) || /CEBOLLA|JUGNARANJ|TOMATE|LECHUGA|CAF[EÉ]/i.test(text);

    // Factura emitida por la propia finca (3101533933) mal metida como compra ALIM.
    const isSelfInvoice = /003101533933/i.test(archivo);
    if (isSelfInvoice) {
      console.log(
        `${APPLY ? "🗑" : "·"} quitar de feeding (factura propia, no compra ALIM): ${label}`
      );
      if (APPLY) {
        await rest(`alimentaciones?id=eq.${cab.id}`, {
          method: "PATCH",
          body: JSON.stringify({ deleted_at: new Date().toISOString() }),
          prefer: "return=minimal",
        });
      }
      removed++;
      continue;
    }

    // Supermercado = comida humana, no kg de engorda.
    if (isSuper && !isAvin && !hasMelaza && !hasGrofactor) {
      console.log(
        `${APPLY ? "🗑" : "·"} quitar de feeding (comida humana / súper): ${label}`
      );
      if (APPLY) {
        await rest(`alimentaciones?id=eq.${cab.id}`, {
          method: "PATCH",
          body: JSON.stringify({ deleted_at: new Date().toISOString() }),
          prefer: "return=minimal",
        });
      }
      removed++;
      continue;
    }

    // --- Caso A: Dos Pinos sin alimento → sacar de feeding + reclasificar gasto ---
    if (isDosPinos && !hasMelaza && !hasGrofactor) {
      const cat = isNC ? "VET" : clasificarNoAlim(descs);
      console.log(
        `${APPLY ? "🗑" : "·"} quitar de feeding (${cat}${isNC ? " NC" : ""}): ${label}`
      );
      console.log(`   líneas: ${descs.slice(0, 4).join(" · ") || "(?)"}`);
      if (APPLY) {
        await rest(`alimentaciones?id=eq.${cab.id}`, {
          method: "PATCH",
          body: JSON.stringify({ deleted_at: new Date().toISOString() }),
          prefer: "return=minimal",
        });
        if (gastoId) {
          const cats = await rest<{ id: string }[]>(
            `categorias_gastos?codigo=eq.${cat}&select=id&limit=1`
          );
          if (cats[0]?.id) {
            await rest(`gastos?id=eq.${gastoId}`, {
              method: "PATCH",
              body: JSON.stringify({ categoria_id: cats[0].id }),
              prefer: "return=minimal",
            });
            reclass++;
          }
        }
      }
      removed++;
      continue;
    }

    // --- Caso B: kg desde extractor (melaza / grofactor / AVIN) ---
    const hit = extractCantidadAlimentoFromText(text, cost);
    if (!hit || hit.cantidad <= 1) {
      if (needsWork) {
        console.log(`⊘ sin kg detectados: ${label}`);
        skipped++;
      }
      continue;
    }

    // Solo corregir si cambia o si estaba "sin kg"
    const newQty = Math.round(hit.cantidad * 1000) / 1000;
    const same =
      Math.abs(newQty - qty) < 0.011 &&
      !(hasGrofactor && /melaz/i.test(d.alimentos?.nombre ?? ""));
    if (same && !needsWork) continue;

    const costoUnitario =
      newQty > 0 ? Math.round((cost / newQty) * 10000) / 10000 : cost;

    let alimentoId = d.alimento_id;
    let productoNote = "";
    if (hasGrofactor) {
      alimentoId = await ensureAlimento({
        granjaId: cab.granja_id,
        codigo: "GRO-DP",
        nombre: "Grofactor Dos Pinos",
        tipo: "concentrado",
      });
      productoNote = " → producto GRO-DP";
    } else if (isAvin && /Ma[ií]z/i.test(text)) {
      alimentoId = await ensureAlimento({
        granjaId: cab.granja_id,
        codigo: "MAIZ-AVIN",
        nombre: "Maíz molido (AVIN)",
        tipo: "concentrado",
      });
      productoNote = " → producto MAIZ-AVIN";
    } else if (hasMelaza) {
      // mantener / asegurar melaza
      productoNote = " (melaza)";
    }

    console.log(
      `${APPLY ? "✓" : "·"} ${label}\n   → ${newQty} kg (${hit.fuente}) · ₡${costoUnitario}/kg${productoNote}`
    );

    if (!APPLY) {
      updatedKg++;
      continue;
    }

    await rest(`detalle_alimentaciones?id=eq.${d.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cantidad: newQty,
        costo_unitario: costoUnitario,
        alimento_id: alimentoId,
      }),
      prefer: "return=minimal",
    });

    if (newQty > 1 && costoUnitario > 0 && costoUnitario <= 5000) {
      await rest(
        `alimentos?id=eq.${alimentoId}&granja_id=eq.${cab.granja_id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            costo_unitario: costoUnitario,
            updated_at: new Date().toISOString(),
          }),
          prefer: "return=minimal",
        }
      );
    }
    updatedKg++;
  }

  console.log(
    `\n${APPLY ? "Aplicado" : "Dry-run"}: kg ${updatedKg} · quitadas feeding ${removed} · gastos reclasificados ${reclass} · omitidas ${skipped}\n`
  );
  if (!APPLY) console.log("Ejecuta con --apply para guardar.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
