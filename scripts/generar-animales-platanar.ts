/**
 * Transcribe las facturas de Subasta Platanar a todas las secciones:
 *  1. Confirma los comprobantes Platanar pendientes → compra + factura + detalle.
 *  2. Genera un animal por cada línea (inventario, pesaje de ingreso, corral,
 *     costos, dashboard) usando raza "Sin definir" y corrales automáticos.
 *
 *   npx tsx scripts/generar-animales-platanar.ts
 */
import { readFileSync, existsSync } from "node:fs";
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
import { confirmComprobante } from "@/lib/api/comprobantes";
import { generarAnimalesDesdeCompra } from "@/lib/api/generar-animales-compra";

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}\n`);

  const { data: comps, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre, estado, compra_id, monto_total, emisor_nombre, emisor_identificacion, fecha_emision, datos_parseados")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .eq("clasificacion", "compra_ganado")
    .ilike("archivo_nombre", "%FACTURA_COMPRADOR%")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!comps?.length) {
    console.log("No hay comprobantes Platanar.");
    return;
  }

  for (const c of comps) {
    const parsed = (c.datos_parseados as { parsed?: { animales?: unknown[]; pesoTotalKg?: number } })?.parsed;
    const nAnimales = parsed?.animales?.length ?? 0;

    if (c.estado !== "confirmado") {
      console.log(`▶ Confirmando ${c.archivo_nombre} (${nAnimales} animales)…`);
      const res = await confirmComprobante(admin, granjaId, c.id, {
        classification: "compra_ganado",
        issuer: c.emisor_nombre,
        issuerId: c.emisor_identificacion,
        issueDate: c.fecha_emision,
        amount: c.monto_total != null ? Number(c.monto_total) : null,
        totalWeightKg: parsed?.pesoTotalKg ?? null,
      });
      if (!res.ok) {
        console.log(`  ✗ ${res.message}`);
        continue;
      }
      const compraId = res.comprobante.compraId!;
      const { count } = await admin
        .from("detalle_compras")
        .select("id", { count: "exact", head: true })
        .eq("compra_id", compraId)
        .not("animal_id", "is", null);
      console.log(`  ✓ Confirmado + ${count ?? 0} animal(es) en inventario.\n`);
    } else if (c.compra_id) {
      // Ya confirmado: generar animales para los detalles que falten.
      const gen = await generarAnimalesDesdeCompra(admin, granjaId, c.compra_id, {
        fechaIngreso: c.fecha_emision,
      });
      console.log(
        `▶ ${c.archivo_nombre} (ya confirmado) → ${gen.created} animal(es) creados${gen.skipped ? `, ${gen.skipped} omitidos` : ""}.`
      );
      if (gen.aretes.length) console.log(`  aretes: ${gen.aretes.join(", ")}\n`);
      else console.log("");
    }
  }

  // Resumen final
  const [{ count: totalAnimales }, { data: corrales }] = await Promise.all([
    admin.from("animales").select("id", { count: "exact", head: true }).eq("granja_id", granjaId).is("deleted_at", null),
    admin.from("corrales").select("codigo, ocupacion_actual, capacidad_maxima").eq("granja_id", granjaId).is("deleted_at", null).order("codigo"),
  ]);
  console.log("─".repeat(50));
  console.log(`Total animales en inventario: ${totalAnimales}`);
  console.log("Corrales:", corrales?.map((c) => `${c.codigo} ${c.ocupacion_actual}/${c.capacidad_maxima}`).join(" · "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
