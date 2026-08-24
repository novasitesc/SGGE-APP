import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoCategoria,
  rollbackGasto,
} from "../lib/gasto-link";
import { TIPO_SALARIO_LABEL } from "../types/obligaciones.types";
import type { CreateSalarioInput, Salario } from "../types/obligaciones.types";
import { getEmpleadoNombre } from "../queries/empleados";
import { getSalario } from "../queries/salarios";

async function conceptoSalario(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateSalarioInput
): Promise<{ concepto: string; empleadoNombre: string }> {
  const empleadoNombre = await getEmpleadoNombre(
    admin,
    granjaId,
    input.empleadoId ?? null,
    input.empleadoNombre ?? null
  );
  if (input.concepto?.trim()) {
    return { concepto: input.concepto.trim(), empleadoNombre };
  }
  return {
    concepto: `Salario ${empleadoNombre} — ${TIPO_SALARIO_LABEL[input.tipo]}`,
    empleadoNombre,
  };
}

export async function createSalario(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateSalarioInput
): Promise<Salario> {
  const { concepto, empleadoNombre } = await conceptoSalario(admin, granjaId, input);
  const gastoId = await crearGastoCategoria(admin, granjaId, "SAL", {
    fecha: input.fechaPago,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("salarios")
    .insert({
      granja_id: granjaId,
      empleado_id: input.empleadoId ?? null,
      empleado_nombre: empleadoNombre,
      periodo_inicio: input.periodoInicio ?? null,
      periodo_fin: input.periodoFin ?? null,
      tipo: input.tipo,
      monto: input.monto,
      fecha_pago: input.fechaPago,
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
  const row = await getSalario(admin, granjaId, data.id);
  if (!row) throw new ApiError("No se pudo leer el salario creado.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "salarios",
    registroId: row.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Salario ${empleadoNombre}: ₡${input.monto}.`,
    datosNuevos: { empleado: empleadoNombre, monto: input.monto },
  });
  return row;
}

export async function updateSalario(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateSalarioInput>
): Promise<Salario> {
  const current = await getSalario(admin, granjaId, id);
  if (!current) throw new ApiError("Salario no encontrado.", 404);
  const merged: CreateSalarioInput = {
    empleadoId: input.empleadoId !== undefined ? input.empleadoId : current.empleadoId,
    empleadoNombre:
      input.empleadoNombre !== undefined ? input.empleadoNombre : current.empleadoNombre,
    periodoInicio: input.periodoInicio !== undefined ? input.periodoInicio : current.periodoInicio,
    periodoFin: input.periodoFin !== undefined ? input.periodoFin : current.periodoFin,
    tipo: input.tipo ?? current.tipo,
    monto: input.monto ?? current.monto,
    fechaPago: input.fechaPago ?? current.fechaPago,
    concepto: input.concepto !== undefined ? input.concepto : current.concepto,
  };
  const { concepto, empleadoNombre } = await conceptoSalario(admin, granjaId, merged);
  const { error } = await admin
    .from("salarios")
    .update({
      empleado_id: merged.empleadoId,
      empleado_nombre: empleadoNombre,
      periodo_inicio: merged.periodoInicio,
      periodo_fin: merged.periodoFin,
      tipo: merged.tipo,
      monto: merged.monto,
      fecha_pago: merged.fechaPago,
      concepto,
    })
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
  const row = await getSalario(admin, granjaId, id);
  if (!row) throw new ApiError("Salario no encontrado.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "salarios",
    registroId: id,
    referencia: concepto.slice(0, 200),
    accion: "modificar",
    resumen: `Salario actualizado: ${concepto} — ₡${merged.monto}.`,
  });
  return row;
}

export async function softDeleteSalario(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getSalario(admin, granjaId, id);
  if (!current) throw new ApiError("Salario no encontrado.", 404);
  const { error } = await admin
    .from("salarios")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "salarios",
    registroId: id,
    referencia: current.concepto.slice(0, 200),
    accion: "eliminar",
    resumen: `Salario eliminado: ${current.concepto} — ₡${current.monto}.`,
  });
}
