import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoCategoria,
  rollbackGasto,
} from "../lib/gasto-link";
import type { CreateViaticoInput, Viatico } from "../types/obligaciones.types";
import { getEmpleadoNombre } from "../queries/empleados";
import { getViatico } from "../queries/viaticos";

async function conceptoViatico(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateViaticoInput
): Promise<{ concepto: string; empleadoNombre: string }> {
  const empleadoNombre = await getEmpleadoNombre(
    admin,
    granjaId,
    input.empleadoId ?? null,
    input.empleadoNombre ?? null
  );
  return {
    concepto: `Viático ${empleadoNombre} — ${input.destino}`,
    empleadoNombre,
  };
}

export async function createViatico(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateViaticoInput
): Promise<Viatico> {
  const { concepto, empleadoNombre } = await conceptoViatico(admin, granjaId, input);
  const gastoId = await crearGastoCategoria(admin, granjaId, "VIAT", {
    fecha: input.fecha,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("viaticos")
    .insert({
      granja_id: granjaId,
      empleado_id: input.empleadoId ?? null,
      empleado_nombre: empleadoNombre,
      fecha: input.fecha,
      destino: input.destino,
      motivo: input.motivo ?? null,
      monto: input.monto,
      gasto_id: gastoId,
      origen: "manual",
    })
    .select("id")
    .single();
  if (error) {
    await rollbackGasto(admin, granjaId, gastoId);
    throw new ApiError(error.message, 400);
  }
  const row = await getViatico(admin, granjaId, data.id);
  if (!row) throw new ApiError("No se pudo leer el viático creado.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "viaticos",
    registroId: row.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Viático ${empleadoNombre} a ${input.destino}: ₡${input.monto}.`,
    datosNuevos: { destino: input.destino, monto: input.monto },
  });
  return row;
}

export async function updateViatico(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateViaticoInput>
): Promise<Viatico> {
  const current = await getViatico(admin, granjaId, id);
  if (!current) throw new ApiError("Viático no encontrado.", 404);
  const merged: CreateViaticoInput = {
    empleadoId: input.empleadoId !== undefined ? input.empleadoId : current.empleadoId,
    empleadoNombre:
      input.empleadoNombre !== undefined ? input.empleadoNombre : current.empleadoNombre,
    fecha: input.fecha ?? current.fecha,
    destino: input.destino ?? current.destino,
    motivo: input.motivo !== undefined ? input.motivo : current.motivo,
    monto: input.monto ?? current.monto,
  };
  const { concepto, empleadoNombre } = await conceptoViatico(admin, granjaId, merged);
  const { error } = await admin
    .from("viaticos")
    .update({
      empleado_id: merged.empleadoId,
      empleado_nombre: empleadoNombre,
      fecha: merged.fecha,
      destino: merged.destino,
      motivo: merged.motivo,
      monto: merged.monto,
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
  }
  const row = await getViatico(admin, granjaId, id);
  if (!row) throw new ApiError("Viático no encontrado.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "viaticos",
    registroId: id,
    referencia: concepto.slice(0, 200),
    accion: "modificar",
    resumen: `Viático actualizado: ${concepto} — ₡${merged.monto}.`,
  });
  return row;
}

export async function softDeleteViatico(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getViatico(admin, granjaId, id);
  if (!current) throw new ApiError("Viático no encontrado.", 404);
  const { error } = await admin
    .from("viaticos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "viaticos",
    registroId: id,
    referencia: `${current.empleadoNombre} — ${current.destino}`.slice(0, 200),
    accion: "eliminar",
    resumen: `Viático eliminado: ${current.empleadoNombre} — ${current.destino} ₡${current.monto}.`,
  });
}
