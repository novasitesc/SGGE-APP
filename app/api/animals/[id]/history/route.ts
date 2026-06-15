import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, isUuid } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  mapHistorialToApi,
  type HistorialRow,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

function normalizeRow(raw: Record<string, unknown>): HistorialRow {
  const userRaw = raw.usuarios;
  const userObj = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  if ("modulo" in raw) {
    return {
      id: String(raw.id),
      granja_id: String(raw.granja_id),
      modulo: raw.modulo as HistorialRow["modulo"],
      registro_id: (raw.registro_id as string) ?? null,
      referencia: String(raw.referencia),
      accion: raw.accion as HistorialRow["accion"],
      resumen: String(raw.resumen),
      datos_anteriores: (raw.datos_anteriores as Record<string, unknown>) ?? null,
      datos_nuevos: (raw.datos_nuevos as Record<string, unknown>) ?? null,
      usuario_id: (raw.usuario_id as string) ?? null,
      created_at: String(raw.created_at),
      usuarios: userObj as HistorialRow["usuarios"],
    };
  }
  return {
    id: String(raw.id),
    granja_id: String(raw.granja_id),
    modulo: "animales",
    registro_id: String(raw.animal_id),
    referencia: String(raw.arete),
    accion: raw.accion as HistorialRow["accion"],
    resumen: String(raw.resumen),
    datos_anteriores: (raw.datos_anteriores as Record<string, unknown>) ?? null,
    datos_nuevos: (raw.datos_nuevos as Record<string, unknown>) ?? null,
    usuario_id: (raw.usuario_id as string) ?? null,
    created_at: String(raw.created_at),
    usuarios: userObj as HistorialRow["usuarios"],
  };
}

async function fetchForAnimal(
  admin: ReturnType<typeof createSupabaseAdmin>,
  granjaId: string,
  animalId: string
) {
  const selectSistema = `
    id, granja_id, modulo, registro_id, referencia, accion, resumen,
    datos_anteriores, datos_nuevos, usuario_id, created_at,
    usuarios ( nombre, apellido, email )
  `;
  const selectLegacy = `
    id, granja_id, animal_id, arete, accion, resumen,
    datos_anteriores, datos_nuevos, usuario_id, created_at,
    usuarios ( nombre, apellido, email )
  `;

  const primary = await admin
    .from("historial_sistema")
    .select(selectSistema)
    .eq("granja_id", granjaId)
    .eq("registro_id", animalId)
    .order("created_at", { ascending: false })
    .limit(100);

  let rows: Record<string, unknown>[] = (primary.data ?? []) as Record<string, unknown>[];

  if (primary.error?.message.includes("historial_sistema")) {
    const legacy = await admin
      .from("historial_animales")
      .select(selectLegacy)
      .eq("granja_id", granjaId)
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (legacy.error) throw new Error(legacy.error.message);
    rows = (legacy.data ?? []) as Record<string, unknown>[];
  } else if (primary.error) {
    throw new Error(primary.error.message);
  }

  return rows.map((row) => mapHistorialToApi(normalizeRow(row)));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const items = await fetchForAnimal(admin, granjaId, animalId);
    return jsonOk(items);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
