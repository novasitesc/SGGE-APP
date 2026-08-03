import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { createActaAnimal, fetchActasForAnimal } from "@/lib/api/actas-animal";

export const dynamic = "force-dynamic";

type PostBody = {
  fecha?: string;
  texto?: string;
  autorNombre?: string;
};

async function getAnimalOr404(
  admin: SupabaseClient,
  granjaId: string,
  animalId: string
) {
  const { data, error } = await admin
    .from("animales")
    .select("id, arete, estados_animales ( codigo )")
    .eq("granja_id", granjaId)
    .eq("id", animalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const animal = await getAnimalOr404(admin, granjaId, animalId);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const actas = await fetchActasForAnimal(admin, animalId);
    return jsonOk({ actas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (msg.includes("actas_animales")) {
      return jsonError(
        "Tabla actas_animales no configurada. Ejecute docs/database/actas-animales.sql en Supabase.",
        503
      );
    }
    return jsonError(msg, 500);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as PostBody;

    const animal = await getAnimalOr404(admin, granjaId, animalId);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const estadoJoin = animal.estados_animales as { codigo: string } | { codigo: string }[] | null;
    const estadoCodigo = Array.isArray(estadoJoin) ? estadoJoin[0]?.codigo : estadoJoin?.codigo;
    if (estadoCodigo === "muerto") {
      return jsonError("No se pueden registrar actas en animales dados de baja.", 400);
    }

    const fecha = body.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    if (!body.texto?.trim()) {
      return jsonError("El texto de la observación es obligatorio.");
    }

    const acta = await createActaAnimal(admin, {
      granjaId,
      animalId,
      arete: animal.arete as string,
      fecha,
      texto: body.texto,
      autorNombre: body.autorNombre,
    });

    return jsonOk({ acta }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (msg.includes("actas_animales")) {
      return jsonError(
        "Tabla actas_animales no configurada. Ejecute docs/database/actas-animales.sql en Supabase.",
        503
      );
    }
    return jsonError(msg, 500);
  }
}
