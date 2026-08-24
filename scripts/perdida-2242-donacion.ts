/**
 * Recategoría arete 2242: de soft-delete (ajuste inventario) a pérdida/baja
 * (estado muerto, visible). Fue comprado y donado a la iglesia el 9 ago 2026.
 *
 *   npx tsx --env-file=.env.local scripts/perdida-2242-donacion.ts
 *   npx tsx --env-file=.env.local scripts/perdida-2242-donacion.ts --confirm
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

const CONFIRM = process.argv.includes("--confirm");
const AUTOR = "Sonia Herrera";
const FECHA_DONACION = "2026-08-09";
const ARETE = "2242";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta .env.local");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: animal, error } = await admin
    .from("animales")
    .select(
      `
      id, arete, granja_id, corral_id, estado_id, deleted_at, observaciones,
      peso_inicial_kg, peso_actual_kg, fecha_ingreso, compra_detalle_id, sexo,
      corrales ( codigo, nombre ),
      estados_animales ( id, codigo, nombre ),
      razas ( nombre )
    `
    )
    .eq("arete", ARETE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!animal) throw new Error(`Arete ${ARETE} no encontrado`);

  const corral = one(animal.corrales as { nombre?: string } | { nombre?: string }[]);
  const estado = one(
    animal.estados_animales as
      | { id?: string; codigo?: string; nombre?: string }
      | { id?: string; codigo?: string; nombre?: string }[]
  );

  let compra: {
    precio_kg?: number;
    subtotal?: number;
    peso_compra_kg?: number;
    compras_animales?:
      | { fecha_compra?: string; folio?: string; tipo_adquisicion?: string }
      | { fecha_compra?: string; folio?: string; tipo_adquisicion?: string }[]
      | null;
  } | null = null;
  if (animal.compra_detalle_id) {
    const { data } = await admin
      .from("detalle_compras")
      .select(
        "precio_kg, subtotal, peso_compra_kg, compras_animales ( fecha_compra, folio, tipo_adquisicion )"
      )
      .eq("id", animal.compra_detalle_id)
      .maybeSingle();
    compra = data;
  }

  const compraCab = one(compra?.compras_animales ?? null);
  const costoCompra = Number(compra?.subtotal ?? 0);

  const { data: estadoMuerto, error: eEst } = await admin
    .from("estados_animales")
    .select("id, codigo, nombre")
    .eq("codigo", "muerto")
    .maybeSingle();
  if (eEst) throw new Error(eEst.message);
  if (!estadoMuerto) throw new Error("Estado 'muerto' no encontrado");

  const { data: catOtro } = await admin
    .from("categorias_gastos")
    .select("id, codigo, nombre")
    .eq("codigo", "OTRO")
    .maybeSingle();

  const { data: gastoExistente } = await admin
    .from("gastos")
    .select("id, concepto, monto, fecha")
    .eq("granja_id", animal.granja_id)
    .is("deleted_at", null)
    .ilike("concepto", "%2242%")
    .limit(5);

  console.log(`\n=== Pérdida financiera ${ARETE} (modo: ${CONFIRM ? "CONFIRM" : "DRY-RUN"}) ===`);
  console.log(`  id=${animal.id}`);
  console.log(`  corral=${corral?.nombre ?? "?"} deleted=${!!animal.deleted_at}`);
  console.log(`  estado actual=${estado?.codigo ?? "?"} → muerto`);
  console.log(`  peso inicial=${animal.peso_inicial_kg} actual=${animal.peso_actual_kg}`);
  console.log(`  ingreso=${animal.fecha_ingreso}`);
  console.log(
    `  compra: ${
      compra
        ? `₡${costoCompra} (${compra.peso_compra_kg} kg × ₡${compra.precio_kg}/kg) folio=${compraCab?.folio ?? "—"} fecha=${compraCab?.fecha_compra ?? "—"}`
        : "SIN registro de compra"
    }`
  );
  console.log(`  gastos con 2242: ${gastoExistente?.length ?? 0}`);
  for (const g of gastoExistente ?? []) {
    console.log(`    ${g.fecha} ₡${g.monto} ${g.concepto}`);
  }
  console.log(`  categoría OTRO: ${catOtro ? catOtro.id : "NO"}`);

  const resumen = costoCompra > 0
    ? `Pérdida financiera arete ${ARETE}: donado a la iglesia el ${FECHA_DONACION}. Se compró (₡${costoCompra.toLocaleString("es-CR")}) y sale como baja, sin ingreso de venta. Autor: ${AUTOR}.`
    : `Pérdida financiera arete ${ARETE}: donado a la iglesia el ${FECHA_DONACION}. Animal comprado que sale como baja, sin ingreso de venta. Autor: ${AUTOR}.`;

  const obs =
    `Pérdida: donado a la iglesia el ${FECHA_DONACION}. Baja financiera. Autor: ${AUTOR}.`.trim();

  if (!CONFIRM) {
    console.log("\nPlan:");
    console.log("  1) Quitar deleted_at (vuelve a inventario como baja)");
    console.log("  2) Estado → muerto (pérdida / baja)");
    console.log("  3) No tocar ocupación de corral (ya se descontó)");
    console.log("  4) Historial + acta con Sonia Herrera");
    console.log(
      "  5) Sin gasto extra en P&L: el costo ya está en la compra del animal; un gasto duplicaría ₡415.800"
    );
    console.log(`\n  Resumen historial:\n  ${resumen}`);
    console.log("\nDRY-RUN. Ejecuta con --confirm para aplicar.");
    return;
  }

  const { error: eUpd } = await admin
    .from("animales")
    .update({
      deleted_at: null,
      estado_id: estadoMuerto.id,
      observaciones: obs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", animal.id);
  if (eUpd) throw new Error(`update animal: ${eUpd.message}`);
  console.log("  ✓ Animal restaurado y marcado muerto (pérdida)");

  const { error: eHist } = await admin.from("historial_sistema").insert({
    granja_id: animal.granja_id,
    modulo: "animales",
    registro_id: animal.id,
    referencia: ARETE,
    accion: "eliminar",
    resumen,
    datos_anteriores: {
      arete: ARETE,
      estado: estado?.nombre ?? estado?.codigo,
      corral: corral?.nombre,
      deletedAt: animal.deleted_at,
      pesoInicialKg: Number(animal.peso_inicial_kg ?? 0),
      pesoActualKg: Number(animal.peso_actual_kg ?? 0),
    },
    datos_nuevos: {
      autor: AUTOR,
      motivo: "donado_iglesia_perdida_financiera",
      estado: "muerto",
      fechaDonacion: FECHA_DONACION,
      costoCompra,
      precioKg: compra?.precio_kg ?? null,
      pesoCompraKg: compra?.peso_compra_kg ?? null,
    },
  });
  if (eHist) console.log(`  ⚠ historial: ${eHist.message}`);
  else console.log("  ✓ Historial pérdida financiera");

  const { error: eActa } = await admin.from("actas_animales").insert({
    granja_id: animal.granja_id,
    animal_id: animal.id,
    fecha: FECHA_DONACION,
    texto: resumen,
    autor_nombre: AUTOR,
  });
  if (eActa) console.log(`  ⚠ acta: ${eActa.message}`);
  else console.log("  ✓ Acta 9 ago 2026");

  const crearGasto = false;
  if (crearGasto) {
    const { error: eGasto } = await admin.from("gastos").insert({
      granja_id: animal.granja_id,
      categoria_id: catOtro!.id,
      concepto: `Pérdida financiera arete ${ARETE}: donado a la iglesia (costo de compra, sin venta). Autor: ${AUTOR}.`,
      monto: costoCompra,
      fecha: FECHA_DONACION,
    });
    if (eGasto) console.log(`  ⚠ gasto: ${eGasto.message}`);
    else console.log(`  ✓ Gasto OTRO ₡${costoCompra} (${FECHA_DONACION})`);
  }

  console.log("\nListo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
