import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import { mapEmpleado } from "../queries/mappers";
import type { CreateEmpleadoInput, Empleado } from "../types/obligaciones.types";

export async function createEmpleado(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateEmpleadoInput,
  usuarioId?: string | null
): Promise<Empleado> {
  const { data, error } = await admin
    .from("empleados")
    .insert({
      granja_id: granjaId,
      nombre: input.nombre,
      apellido: input.apellido ?? null,
      cedula: input.cedula ?? null,
      puesto: input.puesto ?? null,
      fecha_ingreso: input.fechaIngreso ?? null,
      activo: input.activo !== false,
      created_by: usuarioId ?? null,
    })
    .select("id, nombre, apellido, cedula, puesto, fecha_ingreso, activo")
    .single();
  if (error) throw new ApiError(error.message, 400);
  const mapped = mapEmpleado(data as Record<string, unknown>);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "salarios",
    registroId: mapped.id,
    referencia: mapped.nombre,
    accion: "crear",
    resumen: `Empleado registrado: ${mapped.nombre}.`,
    datosNuevos: { nombre: mapped.nombre, cedula: mapped.cedula },
  });
  return mapped;
}

export async function updateEmpleado(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateEmpleadoInput>
): Promise<Empleado> {
  const patch: Record<string, unknown> = {};
  if (input.nombre != null) patch.nombre = input.nombre;
  if (input.apellido !== undefined) patch.apellido = input.apellido;
  if (input.cedula !== undefined) patch.cedula = input.cedula;
  if (input.puesto !== undefined) patch.puesto = input.puesto;
  if (input.fechaIngreso !== undefined) patch.fecha_ingreso = input.fechaIngreso;
  if (input.activo !== undefined) patch.activo = input.activo;

  const { data, error } = await admin
    .from("empleados")
    .update(patch)
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .select("id, nombre, apellido, cedula, puesto, fecha_ingreso, activo")
    .maybeSingle();
  if (error) throw new ApiError(error.message, 400);
  if (!data) throw new ApiError("Empleado no encontrado.", 404);
  return mapEmpleado(data as Record<string, unknown>);
}

export async function softDeleteEmpleado(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const { data, error } = await admin
    .from("empleados")
    .update({ deleted_at: new Date().toISOString(), activo: false })
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .select("id, nombre")
    .maybeSingle();
  if (error) throw new ApiError(error.message, 400);
  if (!data) throw new ApiError("Empleado no encontrado.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "salarios",
    registroId: id,
    referencia: data.nombre,
    accion: "eliminar",
    resumen: `Empleado dado de baja: ${data.nombre}.`,
  });
}
