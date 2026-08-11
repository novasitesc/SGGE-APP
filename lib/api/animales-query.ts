import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";

export const ANIMAL_SELECT = `
  id,
  granja_id,
  arete,
  sexo,
  fecha_nacimiento,
  fecha_ingreso,
  peso_inicial_kg,
  peso_actual_kg,
  corral_id,
  lote_id,
  compra_detalle_id,
  observaciones,
  created_at,
  razas ( nombre, codigo ),
  estados_animales ( codigo, nombre ),
  corrales ( codigo, nombre )
`;

export type AnimalRowSrrg = {
  id: string;
  granja_id: string;
  arete: string;
  sexo: string;
  fecha_nacimiento: string | null;
  fecha_ingreso: string;
  peso_inicial_kg: number;
  peso_actual_kg: number;
  corral_id: string | null;
  lote_id: string | null;
  compra_detalle_id: string | null;
  observaciones: string | null;
  created_at: string;
  razas: { nombre: string; codigo: string } | null;
  estados_animales: { codigo: string; nombre: string } | null;
  corrales: { codigo: string; nombre: string } | null;
};

/** Supabase puede devolver joins como objeto o array según la relación. */
export function normalizeAnimalRow(raw: Record<string, unknown>): AnimalRowSrrg {
  const one = <T>(v: T | T[] | null | undefined): T | null =>
    v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v;

  return {
    ...(raw as unknown as AnimalRowSrrg),
    razas: one(raw.razas as { nombre: string; codigo: string } | { nombre: string; codigo: string }[] | null),
    estados_animales: one(
      raw.estados_animales as
        | { codigo: string; nombre: string }
        | { codigo: string; nombre: string }[]
        | null
    ),
    corrales: one(
      raw.corrales as
        | { codigo: string; nombre: string }
        | { codigo: string; nombre: string }[]
        | null
    ),
  };
}

export async function findRazaId(
  admin: SupabaseClient,
  granjaId: string,
  breed: string
): Promise<string | null> {
  const term = breed.trim();
  const { data, error } = await admin
    .from("razas")
    .select("id")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function getDefaultCategoriaId(
  admin: SupabaseClient,
  granjaId: string
): Promise<string> {
  const { data, error } = await admin
    .from("categorias_animales")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("codigo", "NOVI")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new ApiError("No existe categoría NOVI en la granja.", 409);
  return data.id;
}

export async function getDefaultLoteId(
  admin: SupabaseClient,
  granjaId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("lotes")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("estado", "abierto")
    .is("deleted_at", null)
    .order("fecha_apertura", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function listOpenLotes(
  admin: SupabaseClient,
  granjaId: string
): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await admin
    .from("lotes")
    .select("id, codigo")
    .eq("granja_id", granjaId)
    .eq("estado", "abierto")
    .is("deleted_at", null)
    .order("fecha_apertura", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((l, i) => ({
    id: l.id as string,
    nombre: String(l.codigo || `Lote ${i + 1}`),
  }));
}
