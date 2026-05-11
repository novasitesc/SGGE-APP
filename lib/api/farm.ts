import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resuelve el id de finca: query ?farmId=, env SGGE_DEFAULT_FARM_ID, o la primera finca creada.
 */
export async function resolveFarmId(
  admin: SupabaseClient,
  farmIdParam?: string | null
): Promise<string> {
  if (farmIdParam && isUuid(farmIdParam)) return farmIdParam;
  const env = process.env.SGGE_DEFAULT_FARM_ID;
  if (env && isUuid(env)) return env;
  const { data, error } = await admin
    .from("farms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(
      "No hay fincas en la base de datos. Ejecute las migraciones y el seed, o defina SGGE_DEFAULT_FARM_ID."
    );
  }
  return data.id;
}
