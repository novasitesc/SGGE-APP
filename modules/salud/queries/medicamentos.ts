import type { SupabaseClient } from "@supabase/supabase-js";
import { mapMedicamento } from "./mappers";
import type { Medicamento } from "../types/salud.types";

export async function listMedicamentos(
  admin: SupabaseClient,
  granjaId: string
): Promise<Medicamento[]> {
  const { data, error } = await admin
    .from("medicamentos")
    .select("*")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (error) {
    if (error.code === "42P01" || error.message.includes("granja_id")) {
      const fallback = await admin
        .from("medicamentos")
        .select("*")
        .is("deleted_at", null)
        .order("nombre", { ascending: true });
      if (fallback.error) {
        if (fallback.error.code === "42P01") return [];
        throw new Error(fallback.error.message);
      }
      return (fallback.data ?? []).map((r) =>
        mapMedicamento(r as Record<string, unknown>)
      );
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapMedicamento(r as Record<string, unknown>));
}

export async function findOrCreateMedicamento(
  admin: SupabaseClient,
  granjaId: string,
  nombre: string,
  tipo: string
): Promise<string | null> {
  const trimmed = nombre.trim();
  if (!trimmed) return null;

  const { data: existing } = await admin
    .from("medicamentos")
    .select("id")
    .eq("granja_id", granjaId)
    .ilike("nombre", trimmed)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const codigo = `MED-${trimmed.slice(0, 8).toUpperCase().replace(/\s/g, "")}`;
  const { data, error } = await admin
    .from("medicamentos")
    .insert({
      granja_id: granjaId,
      codigo,
      nombre: trimmed,
      tipo,
      unidad_medida: "dosis",
      costo_unitario: 0,
      activo: true,
    })
    .select("id")
    .single();

  if (error) return null;
  return data.id as string;
}
