import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystemUserId } from "@/lib/api/granja";
import { registrarHistorialAnimal } from "@/lib/api/historial-animal";

export type ActaAnimalRow = {
  id: string;
  animal_id: string;
  granja_id: string;
  fecha: string;
  texto: string;
  autor_nombre: string | null;
  created_at: string;
};

export type ActaAnimalApi = {
  id: string;
  fecha: string;
  texto: string;
  autorNombre?: string;
  createdAt: string;
};

export function mapActaToApi(row: ActaAnimalRow): ActaAnimalApi {
  return {
    id: row.id,
    fecha: row.fecha,
    texto: row.texto,
    autorNombre: row.autor_nombre ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchActasForAnimal(
  admin: SupabaseClient,
  animalId: string
): Promise<ActaAnimalApi[]> {
  const { data, error } = await admin
    .from("actas_animales")
    .select("id, animal_id, granja_id, fecha, texto, autor_nombre, created_at")
    .eq("animal_id", animalId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapActaToApi(row as ActaAnimalRow));
}

export type CreateActaInput = {
  granjaId: string;
  animalId: string;
  arete: string;
  fecha: string;
  texto: string;
  autorNombre?: string;
};

export async function createActaAnimal(
  admin: SupabaseClient,
  input: CreateActaInput
): Promise<ActaAnimalApi> {
  const texto = input.texto.trim();
  if (!texto) throw new Error("El texto de la acta es obligatorio.");

  const { data, error } = await admin
    .from("actas_animales")
    .insert({
      granja_id: input.granjaId,
      animal_id: input.animalId,
      fecha: input.fecha,
      texto,
      autor_nombre: input.autorNombre?.trim() || null,
      registrado_por_id: getSystemUserId(),
    })
    .select("id, animal_id, granja_id, fecha, texto, autor_nombre, created_at")
    .single();

  if (error) throw new Error(error.message);

  const acta = mapActaToApi(data as ActaAnimalRow);

  await registrarHistorialAnimal(admin, {
    granjaId: input.granjaId,
    animalId: input.animalId,
    arete: input.arete,
    accion: "acta",
    resumen: `Acta ${input.fecha}: ${texto.slice(0, 120)}${texto.length > 120 ? "…" : ""}`,
    datosNuevos: {
      actaId: acta.id,
      fecha: acta.fecha,
      texto: acta.texto,
      autorNombre: acta.autorNombre ?? null,
    },
  });

  return acta;
}
