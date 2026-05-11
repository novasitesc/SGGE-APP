import type { SupabaseClient } from "@supabase/supabase-js";

export async function getModuleIdByCode(
  admin: SupabaseClient,
  farmId: string,
  code: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("modules")
    .select("id")
    .eq("farm_id", farmId)
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function countActiveAnimalsInModule(
  admin: SupabaseClient,
  farmId: string,
  moduleId: string,
  excludeAnimalId?: string
): Promise<number> {
  let q = admin
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId)
    .eq("module_id", moduleId)
    .eq("status", "activo");
  if (excludeAnimalId) q = q.neq("id", excludeAnimalId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getModuleCapacity(
  admin: SupabaseClient,
  farmId: string,
  moduleId: string
): Promise<number> {
  const { data, error } = await admin
    .from("modules")
    .select("capacity")
    .eq("farm_id", farmId)
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Módulo no encontrado.");
  return data.capacity;
}
