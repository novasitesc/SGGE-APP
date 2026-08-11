import type { SupabaseClient } from "@supabase/supabase-js";
import { nextCodigoFromList } from "@/lib/modulos/codigo";
import { ApiError } from "@/lib/api/errors";

/** Si el UNIQUE antiguo aún incluye soft-deleted, libera ese código en filas borradas. */
export async function liberarCodigoSoftDeleted(
  admin: SupabaseClient,
  granjaId: string,
  codigo: string
): Promise<void> {
  const stamp = Date.now().toString(36);
  const nuevo = `${codigo.slice(0, 12)}__old__${stamp}`.slice(0, 30);
  await admin
    .from("corrales")
    .update({ codigo: nuevo })
    .eq("granja_id", granjaId)
    .eq("codigo", codigo)
    .not("deleted_at", "is", null);
}

/** Siguiente código libre del tipo (RPC en BD; solo corrales activos → reutiliza M1 si se borró). */
export async function nextCodigoForTipo(
  admin: SupabaseClient,
  granjaId: string,
  tipo: string,
  excludeCorralId?: string
): Promise<string> {
  const { data, error } = await admin.rpc("siguiente_codigo_corral", {
    p_granja_id: granjaId,
    p_tipo: tipo,
    p_exclude_id: excludeCorralId ?? null,
  });

  if (!error && typeof data === "string" && data.trim()) {
    return data.trim().toUpperCase();
  }

  let prefixOverride: string | undefined;
  const { data: tipoRow } = await admin
    .from("tipos_corral")
    .select("prefijo")
    .eq("codigo", tipo)
    .is("deleted_at", null)
    .maybeSingle();
  if (tipoRow?.prefijo) prefixOverride = String(tipoRow.prefijo);

  // Fallback si la migración/RPC aún no está aplicada.
  let q = admin
    .from("corrales")
    .select("id, codigo")
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (excludeCorralId) q = q.neq("id", excludeCorralId);

  const { data: rows, error: e2 } = await q;
  if (e2) throw new Error(error?.message ?? e2.message);

  const codigos = (rows ?? []).map((row) => String(row.codigo ?? ""));
  return nextCodigoFromList(tipo, codigos, prefixOverride);
}

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
  if (!data) throw new ApiError("Corral no encontrado.", 404);
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
