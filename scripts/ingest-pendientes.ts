/**
 * Ingresa TODOS los comprobantes pendientes a sus secciones:
 *  - gasto → tabla `gastos` (Costos / estadísticas)
 *  - compra_ganado → compra + detalle + animal(es)
 *  - venta → tabla `ventas` + factura ingreso (facturas propias de la granja)
 *  - ignorar → marca confirmado sin egreso (aceptaciones duplicadas, etc.)
 *
 * Usa clave fiscal del nombre, catálogo de emisores y overrides conocidos.
 *
 *   npx tsx scripts/ingest-pendientes.ts
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
import { findClaveCR, parseClaveCR } from "@/lib/api/pdf/clave-cr";
import { classifyComprobante } from "@/lib/api/pdf/classify";
import {
  lookupEmisor,
  overrideForFileName,
  CEDULA_GRANJA,
} from "@/lib/api/pdf/emisores-conocidos";

const MIN_MONTO = 100; // descarta montos basura tipo ₡33

async function main() {
  const admin = createSupabaseAdmin();
  const granjaId = await resolveGranjaId(admin, null);
  console.log(`Granja: ${granjaId}\n`);

  const { data: rows, error } = await admin
    .from("comprobantes")
    .select(
      "id, archivo_nombre, estado, clasificacion, categoria_sugerida, confianza, emisor_nombre, emisor_identificacion, monto_total, fecha_emision, folio_fiscal, clave_fiscal, datos_parseados"
    )
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const pendientes = rows ?? [];
  console.log(`Pendientes: ${pendientes.length}\n`);

  let okGasto = 0;
  let okCompra = 0;
  let okVenta = 0;
  let okIgnorar = 0;
  let skip = 0;
  let fail = 0;

  for (const row of pendientes) {
    const name = row.archivo_nombre;
    const clave =
      row.clave_fiscal ?? findClaveCR(name) ?? findClaveCR(String(row.datos_parseados ?? ""));
    const claveInfo = clave ? parseClaveCR(clave) : null;
    const ov = overrideForFileName(name);
    const emisorId =
      ov?.emisorId ??
      row.emisor_identificacion ??
      claveInfo?.emisorIdentificacion ??
      null;
    const known = lookupEmisor(emisorId);

    let clasificacion = ov?.clasificacion ?? (row.clasificacion as string);
    let categoria = ov?.categoria ?? row.categoria_sugerida ?? known?.categoria ?? "OTRO";
    let monto =
      ov?.monto ??
      (row.monto_total != null ? Number(row.monto_total) : null);
    let emisorNombre =
      ov?.emisorNombre ??
      known?.nombre ??
      (row.emisor_nombre && !/[%ÿPDF]|[^\x20-\x7EÁÉÍÓÚÑáéíóúñüÜ]{3,}/.test(row.emisor_nombre.slice(0, 20))
        ? row.emisor_nombre
        : null) ??
      known?.nombre ??
      "Proveedor";
    let fecha =
      ov?.fecha ?? row.fecha_emision ?? claveInfo?.fechaEmision ?? null;
    let pesoKg = ov?.pesoKg ?? null;
    const tipoAdq = ov?.tipoAdquisicion ?? "particular";
    const buyer = ov?.buyer ?? null;

    // Re-clasificar con emisor conocido / propia granja
    if (emisorId === CEDULA_GRANJA || known?.tipo === "venta") {
      clasificacion = "venta";
    } else if (known?.tipo === "ignorar") {
      clasificacion = "ignorar";
    } else if (known?.tipo === "compra_ganado") {
      clasificacion = "compra_ganado";
    } else if (known?.tipo === "gasto") {
      clasificacion = "gasto";
      categoria = known.categoria ?? categoria;
    } else if (clasificacion === "pendiente" && (monto != null || clave)) {
      // Heurística final: si hay monto o clave → gasto OTRO
      clasificacion = "gasto";
      categoria = categoria || "OTRO";
    }

    // Refinar con classify si tenemos datos mínimos
    if (
      clasificacion === "pendiente" ||
      clasificacion === "gasto" ||
      clasificacion === "venta"
    ) {
      const cls = classifyComprobante({
        clave: clave ?? null,
        folioFiscal: row.folio_fiscal ?? claveInfo?.consecutivo ?? null,
        tipoDocumento: claveInfo?.tipoDocumento ?? null,
        emisorNombre,
        emisorIdentificacion: emisorId,
        fechaEmision: fecha,
        moneda: "CRC",
        montoTotal: monto,
        texto: `${name} ${emisorNombre}`,
      });
      if (cls.clasificacion === "venta") clasificacion = "venta";
      else if (cls.clasificacion === "ignorar") clasificacion = "ignorar";
      else if (cls.clasificacion === "compra_ganado") clasificacion = "compra_ganado";
      else if (cls.clasificacion === "gasto" && clasificacion !== "venta") {
        clasificacion = "gasto";
        categoria = cls.categoriaSugerida ?? categoria;
      }
    }

    // Actualizar metadatos en bandeja (siempre)
    await admin
      .from("comprobantes")
      .update({
        clave_fiscal: clave ?? row.clave_fiscal,
        folio_fiscal: row.folio_fiscal ?? claveInfo?.consecutivo ?? null,
        tipo_documento: claveInfo?.tipoDocumento ?? null,
        emisor_nombre: emisorNombre?.slice(0, 200),
        emisor_identificacion: emisorId,
        fecha_emision: fecha,
        monto_total: monto != null && monto >= MIN_MONTO ? monto : row.monto_total,
        clasificacion,
        categoria_sugerida: clasificacion === "gasto" ? categoria : null,
        confianza: ov ? 90 : known ? 85 : row.confianza,
      })
      .eq("id", row.id);

    if (clasificacion === "ignorar") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "ignorar",
        issuer: emisorNombre,
        issuerId: emisorId,
        issueDate: fecha,
        amount: monto != null && monto > 0 ? monto : null,
      });
      if (res.ok) {
        okIgnorar += 1;
        console.log(`⊘ ignorar  ${name.slice(0, 55)}`);
      } else {
        // fallback soft: marcar confirmado a mano
        await admin
          .from("comprobantes")
          .update({ estado: "confirmado", clasificacion: "ignorar" })
          .eq("id", row.id);
        okIgnorar += 1;
        console.log(`⊘ ignorar* ${name.slice(0, 55)}`);
      }
      continue;
    }

    if (monto == null || monto < MIN_MONTO) {
      skip += 1;
      console.log(`· skip (sin monto) [${clasificacion}/${categoria}] ${name.slice(0, 50)}`);
      continue;
    }

    if (clasificacion === "gasto") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "gasto",
        issuer: emisorNombre,
        issuerId: emisorId,
        issueDate: fecha,
        amount: monto,
        categoryCode: categoria ?? "OTRO",
        description: ov?.descripcion ?? `${emisorNombre}${fecha ? ` — ${fecha}` : ""}`,
      });
      if (res.ok) {
        okGasto += 1;
        console.log(`✓ gasto/${categoria} ₡${monto.toLocaleString("es-CR")}  ${name.slice(0, 45)}`);
      } else {
        fail += 1;
        console.log(`✗ gasto ${name.slice(0, 40)}: ${res.message}`);
      }
      continue;
    }

    if (clasificacion === "compra_ganado") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "compra_ganado",
        issuer: emisorNombre,
        issuerId: emisorId,
        issueDate: fecha,
        amount: monto,
        totalWeightKg: pesoKg,
        tipoAdquisicion: tipoAdq,
        description: ov?.descripcion,
      });
      if (res.ok) {
        okCompra += 1;
        console.log(`✓ compra ₡${monto.toLocaleString("es-CR")}  ${name.slice(0, 45)}`);
      } else {
        fail += 1;
        console.log(`✗ compra ${name.slice(0, 40)}: ${res.message}`);
      }
      continue;
    }

    if (clasificacion === "venta") {
      const res = await confirmComprobante(admin, granjaId, row.id, {
        classification: "venta",
        issuer: emisorNombre,
        issuerId: emisorId,
        issueDate: fecha,
        amount: monto,
        buyer,
        totalWeightKg: pesoKg,
        description: ov?.descripcion ?? `Venta — ${name.slice(0, 60)}`,
      });
      if (res.ok) {
        okVenta += 1;
        console.log(`✓ venta ₡${monto.toLocaleString("es-CR")}  ${name.slice(0, 45)}`);
      } else {
        fail += 1;
        console.log(`✗ venta ${name.slice(0, 40)}: ${res.message}`);
      }
      continue;
    }

    skip += 1;
    console.log(`· skip [${clasificacion}] ${name.slice(0, 50)}`);
  }

  const [{ count: nGastos }, { count: nAnim }, { count: nPend }, { count: nVentas }] =
    await Promise.all([
      admin
        .from("gastos")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("animales")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("comprobantes")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .eq("estado", "pendiente")
        .is("deleted_at", null),
      admin
        .from("ventas")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
    ]);

  console.log("\n" + "─".repeat(55));
  console.log(
    `Confirmados gasto: ${okGasto} | compra: ${okCompra} | venta: ${okVenta} | ignorar: ${okIgnorar}`
  );
  console.log(`Omitidos (sin monto): ${skip} | fallidos: ${fail}`);
  console.log(
    `BD ahora → gastos: ${nGastos} | animales: ${nAnim} | ventas: ${nVentas} | comprobantes pendientes: ${nPend}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
