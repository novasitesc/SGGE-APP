import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCorralIdByCodigo(
  admin: SupabaseClient,
  granjaId: string,
  codigo: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("corrales")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("codigo", codigo)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/** Compatibilidad con nombre anterior (module = corral). */
export const getModuleIdByCode = getCorralIdByCodigo;

export async function getEstadoIdByCodigo(
  admin: SupabaseClient,
  codigo: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("estados_animales")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function countActiveAnimalsInCorral(
  admin: SupabaseClient,
  granjaId: string,
  corralId: string,
  excludeAnimalId?: string
): Promise<number> {
  const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
  if (!estadoActivo) return 0;

  let q = admin
    .from("animales")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .eq("corral_id", corralId)
    .eq("estado_id", estadoActivo)
    .is("deleted_at", null);
  if (excludeAnimalId) q = q.neq("id", excludeAnimalId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const countActiveAnimalsInModule = countActiveAnimalsInCorral;

export async function getCorralCapacity(
  admin: SupabaseClient,
  granjaId: string,
  corralId: string
): Promise<number> {
  const { data, error } = await admin
    .from("corrales")
    .select("capacidad_maxima")
    .eq("granja_id", granjaId)
    .eq("id", corralId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Corral no encontrado.");
  return data.capacidad_maxima as number;
}

export const getModuleCapacity = getCorralCapacity;

export async function adjustCorralOcupacion(
  admin: SupabaseClient,
  corralId: string,
  delta: number
): Promise<void> {
  const { data, error: e0 } = await admin
    .from("corrales")
    .select("ocupacion_actual, capacidad_maxima")
    .eq("id", corralId)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!data) return;

  const next = Math.max(0, (data.ocupacion_actual as number) + delta);
  const { error } = await admin
    .from("corrales")
    .update({ ocupacion_actual: next })
    .eq("id", corralId);
  if (error) throw new Error(error.message);
}
