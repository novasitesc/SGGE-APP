import type { SupabaseClient } from "@supabase/supabase-js";
import { mapEmpleado } from "./mappers";
import type { Empleado } from "../types/obligaciones.types";

const SELECT =
  "id, nombre, apellido, cedula, puesto, fecha_ingreso, activo";

export async function listEmpleados(
  admin: SupabaseClient,
  granjaId: string,
  opts?: { includeInactive?: boolean }
): Promise<Empleado[]> {
  let query = admin
    .from("empleados")
    .select(SELECT)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });
  if (!opts?.includeInactive) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapEmpleado(r as Record<string, unknown>));
}

export async function getEmpleadoNombre(
  admin: SupabaseClient,
  granjaId: string,
  empleadoId: string | null,
  fallback: string | null
): Promise<string> {
  if (fallback?.trim()) return fallback.trim();
  if (!empleadoId) return "Personal";
  const { data, error } = await admin
    .from("empleados")
    .select("nombre, apellido")
    .eq("granja_id", granjaId)
    .eq("id", empleadoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "Personal";
  return [data.nombre, data.apellido].filter(Boolean).join(" ");
}
