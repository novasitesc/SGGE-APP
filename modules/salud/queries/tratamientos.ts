import type { SupabaseClient } from "@supabase/supabase-js";
import { mapTreatment } from "./mappers";
import type { TreatmentRecord } from "../types/salud.types";
export { computeSaludKpis } from "../lib/kpis";

const SELECT_TRATAMIENTO = `
  id, granja_id, animal_id, lote_id, medicamento_id, tipo, nombre,
  fecha_inicio, proxima_aplicacion, animal_count, costo_por_animal, costo_total,
  estado, aplicado_por, observaciones, origen, deleted_at,
  fecha_fin_carencia, listo_traslado,
  medicamentos(nombre, periodo_carencia_dias)
`;

export type ListTreatmentsFilters = {
  from?: string;
  to?: string;
  type?: string;
  q?: string;
  animalId?: string;
  limit?: number;
};

export async function listTratamientos(
  admin: SupabaseClient,
  granjaId: string,
  filters: ListTreatmentsFilters = {}
): Promise<TreatmentRecord[]> {
  let query = admin
    .from("tratamientos")
    .select(SELECT_TRATAMIENTO)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("fecha_inicio", { ascending: false });

  if (filters.from) query = query.gte("fecha_inicio", filters.from);
  if (filters.to) query = query.lte("fecha_inicio", filters.to);
  if (filters.type) query = query.eq("tipo", filters.type);
  if (filters.animalId) {
    const linked = await listTratamientoIdsByAnimal(admin, filters.animalId);
    if (linked.length > 0) {
      query = query.or(
        `animal_id.eq.${filters.animalId},id.in.(${linked.join(",")})`
      );
    } else {
      query = query.eq("animal_id", filters.animalId);
    }
  }
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) {
    // Fallback: columnas nuevas o tablas sin granja_id (remoto legado)
    if (
      error.message.includes("granja_id") ||
      error.message.includes("fecha_fin_carencia") ||
      error.message.includes("listo_traslado") ||
      error.message.includes("periodo_carencia") ||
      error.code === "42703"
    ) {
      return listTratamientosLegacy(admin, granjaId, filters);
    }
    throw new Error(error.message);
  }

  let rows = (data ?? []).map((r) => mapTreatment(r as Record<string, unknown>));
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.appliedBy.toLowerCase().includes(q) ||
        String(t.type).toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
    );
  }
  return rows;
}

async function listTratamientoIdsByAnimal(
  admin: SupabaseClient,
  animalId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("tratamiento_animales")
    .select("tratamiento_id")
    .eq("animal_id", animalId);
  if (error) return [];
  return (data ?? []).map((r: { tratamiento_id: string }) => r.tratamiento_id);
}

async function listTratamientosLegacy(
  admin: SupabaseClient,
  granjaId: string,
  filters: ListTreatmentsFilters
): Promise<TreatmentRecord[]> {
  const { data: animales } = await admin
    .from("animales")
    .select("id")
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  const ids = (animales ?? []).map((a: { id: string }) => a.id);
  if (ids.length === 0) return [];

  let query = admin
    .from("tratamientos")
    .select(
      "id, animal_id, medicamento_id, fecha_inicio, costo_total, estado, observaciones, deleted_at, medicamentos(nombre)"
    )
    .in("animal_id", ids)
    .is("deleted_at", null)
    .order("fecha_inicio", { ascending: false });

  if (filters.from) query = query.gte("fecha_inicio", filters.from);
  if (filters.to) query = query.lte("fecha_inicio", filters.to);
  if (filters.animalId) query = query.eq("animal_id", filters.animalId);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTreatment(r as Record<string, unknown>));
}

export async function getTratamientoById(
  admin: SupabaseClient,
  id: string
): Promise<TreatmentRecord | null> {
  const { data, error } = await admin
    .from("tratamientos")
    .select(SELECT_TRATAMIENTO)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTreatment(data as Record<string, unknown>) : null;
}

export async function listTratamientosByAnimal(
  admin: SupabaseClient,
  animalId: string
): Promise<TreatmentRecord[]> {
  const linked = await listTratamientoIdsByAnimal(admin, animalId);
  let query = admin
    .from("tratamientos")
    .select(SELECT_TRATAMIENTO)
    .is("deleted_at", null)
    .order("fecha_inicio", { ascending: false });

  if (linked.length > 0) {
    query = query.or(`animal_id.eq.${animalId},id.in.(${linked.join(",")})`);
  } else {
    query = query.eq("animal_id", animalId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTreatment(r as Record<string, unknown>));
}
