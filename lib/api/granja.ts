import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID del usuario sistema para pesajes/movimientos (seed: admin@srrg.demo). */
export function getSystemUserId(): string {
  const env = process.env.SRRG_SYSTEM_USER_ID;
  if (env && isUuid(env)) return env;
  return "33333333-3333-3333-3333-333333333333";
}

/**
 * Resuelve granja_id: ?farmId= / ?granjaId=, env SRRG_DEFAULT_GRANJA_ID o SGGE_DEFAULT_FARM_ID.
 */
export async function resolveGranjaId(
  admin: SupabaseClient,
  param?: string | null
): Promise<string> {
  if (param && isUuid(param)) return param;
  for (const key of ["SRRG_DEFAULT_GRANJA_ID", "SGGE_DEFAULT_FARM_ID"]) {
    const env = process.env[key];
    if (env && isUuid(env)) return env;
  }
  const { data, error } = await admin
    .from("granjas")
    .select("id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(
      "No hay granjas en la base de datos. Ejecute schema.sql y seeds.sql, o defina SRRG_DEFAULT_GRANJA_ID."
    );
  }
  return data.id;
}

/** @deprecated Usar resolveGranjaId */
export async function resolveFarmId(
  admin: SupabaseClient,
  farmIdParam?: string | null
): Promise<string> {
  return resolveGranjaId(admin, farmIdParam);
}
