import type { SupabaseClient } from "@supabase/supabase-js";

/** Formato UUID hex 8-4-4-4-12 (incluye seeds demo tipo aaaaaaaa-… / 33333333-…). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Resuelve granja_id para scripts/CLI (env o primera granja).
 * En Route Handlers usar `requireApiContext` (lib/api/auth.ts): membership por sesión.
 * No aceptar un UUID arbitrario del cliente sin autorización.
 */
export async function resolveGranjaId(
  admin: SupabaseClient,
  param?: string | null
): Promise<string> {
  for (const key of ["SRRG_DEFAULT_GRANJA_ID", "SGGE_DEFAULT_FARM_ID"]) {
    const env = process.env[key];
    if (env && isUuid(env)) {
      if (param && isUuid(param) && param !== env) {
        throw new Error(
          "farmId/granjaId no coincide con la granja configurada en el entorno."
        );
      }
      return env;
    }
  }
  if (param && isUuid(param)) {
    const { data, error } = await admin
      .from("granjas")
      .select("id")
      .eq("id", param)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Granja no encontrada.");
    return data.id;
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
