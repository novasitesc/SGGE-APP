import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoBodega,
  rollbackGasto,
} from "../lib/gasto-link";
import { BODEGA_LINEA_LABEL, CODIGO_POR_LINEA } from "../types/bodega.types";
import type { BodegaCompra, CreateBodegaCompraInput } from "../types/bodega.types";
import { getBodegaCompra } from "../queries/compras";

function conceptoCompra(input: CreateBodegaCompraInput): string {
  if (input.concepto?.trim()) return input.concepto.trim();
  const linea = BODEGA_LINEA_LABEL[input.linea];
  return `${input.proveedor} — ${input.producto} (${linea})`;
}

export async function createBodegaCompra(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateBodegaCompraInput
): Promise<BodegaCompra> {
  const concepto = conceptoCompra(input);
  const codigo = CODIGO_POR_LINEA[input.linea];
  const gastoId = await crearGastoBodega(admin, granjaId, codigo, {
    fecha: input.fecha,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("bodega_compras")
    .insert({
      granja_id: granjaId,
      linea: input.linea,
      fecha: input.fecha,
      proveedor: input.proveedor,
      producto: input.producto,
      cantidad: input.cantidad ?? null,
      unidad: input.unidad ?? "kg",
      monto: input.monto,
      concepto,
      gasto_id: gastoId,
      origen: "manual",
    })
    .select("id")
    .single();
  if (error) {
    await rollbackGasto(admin, granjaId, gastoId);
    throw new ApiError(error.message, 400);
  }
  const row = await getBodegaCompra(admin, granjaId, data.id as string);
  if (!row) throw new ApiError("No se pudo leer la compra creada.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "bodega",
    registroId: row.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Bodega (${BODEGA_LINEA_LABEL[input.linea]}): ${concepto} — ₡${input.monto}.`,
    datosNuevos: {
      linea: input.linea,
      producto: input.producto,
      proveedor: input.proveedor,
      monto: input.monto,
    },
  });
  return row;
}

export async function updateBodegaCompra(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateBodegaCompraInput>
): Promise<BodegaCompra> {
  const current = await getBodegaCompra(admin, granjaId, id);
  if (!current) throw new ApiError("Compra de bodega no encontrada.", 404);

  const merged: CreateBodegaCompraInput = {
    linea: input.linea ?? current.linea,
    fecha: input.fecha ?? current.fecha,
    proveedor: input.proveedor ?? current.proveedor,
    producto: input.producto ?? current.producto,
    cantidad: input.cantidad !== undefined ? input.cantidad : current.cantidad,
    unidad: input.unidad ?? current.unidad,
    monto: input.monto ?? current.monto,
    concepto: input.concepto !== undefined ? input.concepto : current.concepto,
  };
  const concepto = conceptoCompra(merged);
  const { error } = await admin
    .from("bodega_compras")
    .update({
      linea: merged.linea,
      fecha: merged.fecha,
      proveedor: merged.proveedor,
      producto: merged.producto,
      cantidad: merged.cantidad ?? null,
      unidad: merged.unidad ?? "kg",
      monto: merged.monto,
      concepto,
    })
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);

  if (current.gastoId) {
    await actualizarGastoVinculado(admin, granjaId, current.gastoId, {
      fecha: merged.fecha,
      concepto,
      monto: merged.monto,
    });
    if (merged.linea !== current.linea) {
      const codigo = CODIGO_POR_LINEA[merged.linea];
      const { data: categoria, error: eCat } = await admin
        .from("categorias_gastos")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();
      if (eCat) throw new Error(eCat.message);
      if (categoria) {
        await admin
          .from("gastos")
          .update({ categoria_id: categoria.id })
          .eq("id", current.gastoId)
          .eq("granja_id", granjaId);
      }
    }
  }

  const row = await getBodegaCompra(admin, granjaId, id);
  if (!row) throw new ApiError("Compra de bodega no encontrada.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "bodega",
    registroId: id,
    referencia: concepto.slice(0, 200),
    accion: "modificar",
    resumen: `Bodega actualizada: ${concepto} — ₡${merged.monto}.`,
    datosAnteriores: { monto: current.monto, fecha: current.fecha, linea: current.linea },
    datosNuevos: { monto: merged.monto, fecha: merged.fecha, linea: merged.linea },
  });
  return row;
}

export async function softDeleteBodegaCompra(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getBodegaCompra(admin, granjaId, id);
  if (!current) throw new ApiError("Compra de bodega no encontrada.", 404);
  const { error } = await admin
    .from("bodega_compras")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "bodega",
    registroId: id,
    referencia: current.concepto.slice(0, 200),
    accion: "eliminar",
    resumen: `Bodega eliminada: ${current.concepto} — ₡${current.monto}.`,
    datosAnteriores: {
      monto: current.monto,
      producto: current.producto,
      linea: current.linea,
    },
  });
}
