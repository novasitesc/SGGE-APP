import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWeightKg } from "@/lib/api/weight-utils";

/** Registra o actualiza el pesaje del día (evita duplicados por fecha). */
export async function upsertPesajeAnimal(
  admin: SupabaseClient,
  params: {
    animalId: string;
    fechaPesaje: string;
    pesoKg: number;
    tipoPesaje: string;
    registradoPorId: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const peso = normalizeWeightKg(params.pesoKg);
  const fecha = params.fechaPesaje.slice(0, 10);

  const { data: existing } = await admin
    .from("pesajes")
    .select("id")
    .eq("animal_id", params.animalId)
    .eq("fecha_pesaje", fecha)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("pesajes")
      .update({ peso_kg: peso, tipo_pesaje: params.tipoPesaje })
      .eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  const { error } = await admin.from("pesajes").insert({
    animal_id: params.animalId,
    fecha_pesaje: fecha,
    peso_kg: peso,
    tipo_pesaje: params.tipoPesaje,
    registrado_por_id: params.registradoPorId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export { normalizeWeightKg, parseWeightField } from "@/lib/api/weight-utils";
