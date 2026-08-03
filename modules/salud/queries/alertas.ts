import type { SupabaseClient } from "@supabase/supabase-js";
import { mapAlert } from "./mappers";
import type { HealthAlertRecord } from "../types/salud.types";

const SELECT_ALERTA = `
  id, granja_id, animal_id, tag_id, tipo, mensaje, fecha_vencimiento,
  prioridad, estado, tratamiento_id, resuelta_at, deleted_at
`;

export async function listAlertas(
  admin: SupabaseClient,
  granjaId: string,
  opts: { includeResolved?: boolean; limit?: number } = {}
): Promise<HealthAlertRecord[]> {
  let query = admin
    .from("alertas_sanitarias")
    .select(SELECT_ALERTA)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("fecha_vencimiento", { ascending: true });

  if (!opts.includeResolved) {
    query = query.eq("estado", "activa");
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    // Tabla aún no migrada
    if (
      error.message.includes("alertas_sanitarias") ||
      error.code === "42P01"
    ) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapAlert(r as Record<string, unknown>));
}

export async function getAlertaById(
  admin: SupabaseClient,
  id: string
): Promise<HealthAlertRecord | null> {
  const { data, error } = await admin
    .from("alertas_sanitarias")
    .select(SELECT_ALERTA)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAlert(data as Record<string, unknown>) : null;
}

export async function countAlertasAltas(
  admin: SupabaseClient,
  granjaId: string
): Promise<number> {
  const { count, error } = await admin
    .from("alertas_sanitarias")
    .select("id", { count: "exact", head: true })
    .eq("granja_id", granjaId)
    .eq("estado", "activa")
    .eq("prioridad", "alta")
    .is("deleted_at", null);
  if (error) {
    if (error.code === "42P01") return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}
