import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoCategoria,
  rollbackGasto,
} from "../lib/gasto-link";
import { TIPO_POLIZA_LABEL } from "../types/obligaciones.types";
import type {
  CreatePolizaInput,
  CreatePolizaPagoInput,
  Poliza,
  PolizaPago,
} from "../types/obligaciones.types";
import { getPoliza, listPolizas } from "../queries/polizas";
import { mapPolizaPago } from "../queries/mappers";

export async function createPoliza(
  admin: SupabaseClient,
  granjaId: string,
  input: CreatePolizaInput
): Promise<Poliza> {
  const { data, error } = await admin
    .from("polizas")
    .insert({
      granja_id: granjaId,
      aseguradora: input.aseguradora ?? "INS",
      numero_poliza: input.numeroPoliza,
      tipo: input.tipo,
      vigencia_desde: input.vigenciaDesde ?? null,
      vigencia_hasta: input.vigenciaHasta ?? null,
      prima_total: input.primaTotal ?? null,
      estado: input.estado ?? "vigente",
      notas: input.notas ?? null,
    })
    .select("id")
    .single();
  if (error) throw new ApiError(error.message, 400);
  const row = await getPoliza(admin, granjaId, data.id);
  if (!row) throw new ApiError("No se pudo leer la póliza creada.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "polizas",
    registroId: row.id,
    referencia: row.numeroPoliza,
    accion: "crear",
    resumen: `Póliza ${row.aseguradora} ${row.numeroPoliza} (${TIPO_POLIZA_LABEL[row.tipo]}).`,
    datosNuevos: { numero: row.numeroPoliza, tipo: row.tipo },
  });
  return row;
}

export async function updatePoliza(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreatePolizaInput>
): Promise<Poliza> {
  const current = await getPoliza(admin, granjaId, id);
  if (!current) throw new ApiError("Póliza no encontrada.", 404);
  const patch: Record<string, unknown> = {};
  if (input.aseguradora != null) patch.aseguradora = input.aseguradora;
  if (input.numeroPoliza != null) patch.numero_poliza = input.numeroPoliza;
  if (input.tipo != null) patch.tipo = input.tipo;
  if (input.vigenciaDesde !== undefined) patch.vigencia_desde = input.vigenciaDesde;
  if (input.vigenciaHasta !== undefined) patch.vigencia_hasta = input.vigenciaHasta;
  if (input.primaTotal !== undefined) patch.prima_total = input.primaTotal;
  if (input.estado != null) patch.estado = input.estado;
  if (input.notas !== undefined) patch.notas = input.notas;
  const { error } = await admin
    .from("polizas")
    .update(patch)
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);
  const row = await getPoliza(admin, granjaId, id);
  if (!row) throw new ApiError("Póliza no encontrada.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "polizas",
    registroId: id,
    referencia: row.numeroPoliza,
    accion: "modificar",
    resumen: `Póliza ${row.numeroPoliza} actualizada.`,
  });
  return row;
}

export async function softDeletePoliza(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getPoliza(admin, granjaId, id);
  if (!current) throw new ApiError("Póliza no encontrada.", 404);
  const now = new Date().toISOString();
  for (const pago of current.pagos) {
    await admin
      .from("poliza_pagos")
      .update({ deleted_at: now })
      .eq("id", pago.id)
      .eq("granja_id", granjaId);
    await anularGastoVinculado(admin, granjaId, pago.gastoId);
  }
  const { error } = await admin
    .from("polizas")
    .update({ deleted_at: now, estado: "cancelada" })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "polizas",
    registroId: id,
    referencia: current.numeroPoliza,
    accion: "eliminar",
    resumen: `Póliza ${current.numeroPoliza} y ${current.pagosCount} pago(s) anulados.`,
  });
}

export async function createPolizaPago(
  admin: SupabaseClient,
  granjaId: string,
  polizaId: string,
  input: CreatePolizaPagoInput
): Promise<PolizaPago> {
  const poliza = await getPoliza(admin, granjaId, polizaId);
  if (!poliza) throw new ApiError("Póliza no encontrada.", 404);
  const concepto =
    input.concepto?.trim() ||
    `Póliza ${poliza.numeroPoliza} — ${TIPO_POLIZA_LABEL[poliza.tipo]}`;
  const gastoId = await crearGastoCategoria(admin, granjaId, "POL", {
    fecha: input.fecha,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("poliza_pagos")
    .insert({
      granja_id: granjaId,
      poliza_id: polizaId,
      fecha: input.fecha,
      monto: input.monto,
      periodo_desde: input.periodoDesde ?? null,
      periodo_hasta: input.periodoHasta ?? null,
      concepto,
      gasto_id: gastoId,
      origen: "manual",
    })
    .select(
      "id, poliza_id, fecha, monto, periodo_desde, periodo_hasta, concepto, gasto_id, comprobante_id, origen"
    )
    .single();
  if (error) {
    await rollbackGasto(admin, granjaId, gastoId);
    throw new ApiError(error.message, 400);
  }
  const mapped = mapPolizaPago(data as Record<string, unknown>);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "polizas",
    registroId: mapped.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Pago de póliza ${poliza.numeroPoliza}: ₡${input.monto}.`,
    datosNuevos: { monto: input.monto, fecha: input.fecha },
  });
  return mapped;
}

export async function updatePolizaPago(
  admin: SupabaseClient,
  granjaId: string,
  pagoId: string,
  input: Partial<CreatePolizaPagoInput>
): Promise<PolizaPago> {
  const polizas = await listPolizas(admin, granjaId);
  const current = polizas.flatMap((p) => p.pagos).find((p) => p.id === pagoId);
  if (!current) throw new ApiError("Pago no encontrado.", 404);
  const fecha = input.fecha ?? current.fecha;
  const monto = input.monto ?? current.monto;
  const concepto = input.concepto?.trim() || current.concepto;
  const { error } = await admin
    .from("poliza_pagos")
    .update({
      fecha,
      monto,
      periodo_desde: input.periodoDesde !== undefined ? input.periodoDesde : current.periodoDesde,
      periodo_hasta: input.periodoHasta !== undefined ? input.periodoHasta : current.periodoHasta,
      concepto,
    })
    .eq("id", pagoId)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);
  if (current.gastoId) {
    await actualizarGastoVinculado(admin, granjaId, current.gastoId, {
      fecha,
      concepto,
      monto,
    });
  }
  return {
    ...current,
    fecha,
    monto,
    concepto,
    periodoDesde: input.periodoDesde !== undefined ? input.periodoDesde : current.periodoDesde,
    periodoHasta: input.periodoHasta !== undefined ? input.periodoHasta : current.periodoHasta,
  };
}

export async function softDeletePolizaPago(
  admin: SupabaseClient,
  granjaId: string,
  pagoId: string
): Promise<void> {
  const polizas = await listPolizas(admin, granjaId);
  const current = polizas.flatMap((p) => p.pagos).find((p) => p.id === pagoId);
  if (!current) throw new ApiError("Pago no encontrado.", 404);
  const { error } = await admin
    .from("poliza_pagos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pagoId)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "polizas",
    registroId: pagoId,
    referencia: current.concepto.slice(0, 200),
    accion: "eliminar",
    resumen: `Pago de póliza anulado: ${current.concepto} — ₡${current.monto}.`,
  });
}
