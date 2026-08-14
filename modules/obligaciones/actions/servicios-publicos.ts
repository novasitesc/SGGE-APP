import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoCategoria,
  rollbackGasto,
} from "../lib/gasto-link";
import { TIPO_SERVICIO_LABEL } from "../types/obligaciones.types";
import type {
  CreateServicioPublicoInput,
  ServicioPublico,
} from "../types/obligaciones.types";
import { getServicioPublico } from "../queries/servicios-publicos";

function conceptoServicio(input: CreateServicioPublicoInput): string {
  if (input.concepto?.trim()) return input.concepto.trim();
  const tipo = TIPO_SERVICIO_LABEL[input.tipo];
  const periodo = input.periodoInicio
    ? ` ${input.periodoInicio.slice(0, 7)}`
    : "";
  return `${input.proveedor} — ${tipo}${periodo}`;
}

export async function createServicioPublico(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateServicioPublicoInput
): Promise<ServicioPublico> {
  const concepto = conceptoServicio(input);
  const gastoId = await crearGastoCategoria(admin, granjaId, "SPUB", {
    fecha: input.fechaPago,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("servicios_publicos")
    .insert({
      granja_id: granjaId,
      tipo: input.tipo,
      proveedor: input.proveedor,
      numero_cuenta: input.numeroCuenta ?? null,
      periodo_inicio: input.periodoInicio ?? null,
      periodo_fin: input.periodoFin ?? null,
      fecha_pago: input.fechaPago,
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
  const row = await getServicioPublico(admin, granjaId, data.id);
  if (!row) throw new ApiError("No se pudo leer el servicio creado.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "servicios_publicos",
    registroId: row.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Servicio público: ${concepto} — ₡${input.monto}.`,
    datosNuevos: { tipo: input.tipo, proveedor: input.proveedor, monto: input.monto },
  });
  return row;
}

export async function updateServicioPublico(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateServicioPublicoInput>
): Promise<ServicioPublico> {
  const current = await getServicioPublico(admin, granjaId, id);
  if (!current) throw new ApiError("Servicio público no encontrado.", 404);

  const merged: CreateServicioPublicoInput = {
    tipo: input.tipo ?? current.tipo,
    proveedor: input.proveedor ?? current.proveedor,
    numeroCuenta: input.numeroCuenta !== undefined ? input.numeroCuenta : current.numeroCuenta,
    periodoInicio: input.periodoInicio !== undefined ? input.periodoInicio : current.periodoInicio,
    periodoFin: input.periodoFin !== undefined ? input.periodoFin : current.periodoFin,
    fechaPago: input.fechaPago ?? current.fechaPago,
    monto: input.monto ?? current.monto,
    concepto: input.concepto !== undefined ? input.concepto : current.concepto,
  };
  const concepto = conceptoServicio(merged);
  const patch = {
    tipo: merged.tipo,
    proveedor: merged.proveedor,
    numero_cuenta: merged.numeroCuenta,
    periodo_inicio: merged.periodoInicio,
    periodo_fin: merged.periodoFin,
    fecha_pago: merged.fechaPago,
    monto: merged.monto,
    concepto,
  };
  const { error } = await admin
    .from("servicios_publicos")
    .update(patch)
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);

  if (current.gastoId) {
    await actualizarGastoVinculado(admin, granjaId, current.gastoId, {
      fecha: merged.fechaPago,
      concepto,
      monto: merged.monto,
    });
  }

  const row = await getServicioPublico(admin, granjaId, id);
  if (!row) throw new ApiError("Servicio público no encontrado.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "servicios_publicos",
    registroId: id,
    referencia: concepto.slice(0, 200),
    accion: "modificar",
    resumen: `Servicio público actualizado: ${concepto} — ₡${merged.monto}.`,
    datosAnteriores: { monto: current.monto, fecha: current.fechaPago },
    datosNuevos: { monto: merged.monto, fecha: merged.fechaPago },
  });
  return row;
}

export async function softDeleteServicioPublico(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getServicioPublico(admin, granjaId, id);
  if (!current) throw new ApiError("Servicio público no encontrado.", 404);
  const { error } = await admin
    .from("servicios_publicos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "servicios_publicos",
    registroId: id,
    referencia: current.concepto.slice(0, 200),
    accion: "eliminar",
    resumen: `Servicio público eliminado: ${current.concepto} — ₡${current.monto}.`,
    datosAnteriores: { monto: current.monto, proveedor: current.proveedor },
  });
}
