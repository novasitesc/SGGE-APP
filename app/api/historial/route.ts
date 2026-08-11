import { isUuid } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  mapHistorialToApi,
  type HistorialAccion,
  type HistorialModulo,
  type HistorialRow,
  MODULO_LABELS,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

const MODULOS_VALIDOS = Object.keys(MODULO_LABELS) as HistorialModulo[];
const ACCIONES_VALIDAS: HistorialAccion[] = [
  "crear",
  "modificar",
  "eliminar",
  "vender",
  "pesaje",
];

const SELECT_SISTEMA =
  "id, granja_id, modulo, registro_id, referencia, accion, resumen, datos_anteriores, datos_nuevos, usuario_id, created_at, usuarios(nombre, apellido, email)";

const SELECT_LEGACY =
  "id, granja_id, animal_id, arete, accion, resumen, datos_anteriores, datos_nuevos, usuario_id, created_at, usuarios(nombre, apellido, email)";

function normalizeRow(raw: Record<string, unknown>): HistorialRow {
  const userRaw = raw.usuarios;
  const userObj = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  if ("modulo" in raw) {
    return {
      id: String(raw.id),
      granja_id: String(raw.granja_id),
      modulo: raw.modulo as HistorialModulo,
      registro_id: (raw.registro_id as string) ?? null,
      referencia: String(raw.referencia),
      accion: raw.accion as HistorialAccion,
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
    accion: raw.accion as HistorialAccion,
    resumen: String(raw.resumen),
    datos_anteriores: (raw.datos_anteriores as Record<string, unknown>) ?? null,
    datos_nuevos: (raw.datos_nuevos as Record<string, unknown>) ?? null,
    usuario_id: (raw.usuario_id as string) ?? null,
    created_at: String(raw.created_at),
    usuarios: userObj as HistorialRow["usuarios"],
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const referencia = url.searchParams.get("referencia") ?? url.searchParams.get("arete");
    const modulo = url.searchParams.get("modulo")?.trim() as HistorialModulo | undefined;
    const registroId = url.searchParams.get("registroId") ?? url.searchParams.get("animalId");
    const accion = url.searchParams.get("accion")?.trim() as HistorialAccion | undefined;
    const desde = url.searchParams.get("desde")?.trim();
    const hasta = url.searchParams.get("hasta")?.trim();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    if (registroId && !isUuid(registroId)) return jsonError("registroId inválido.");
    if (modulo && !MODULOS_VALIDOS.includes(modulo)) {
      return jsonError(`Módulo '${modulo}' no válido.`);
    }
    if (accion && !ACCIONES_VALIDAS.includes(accion)) {
      return jsonError(`Acción '${accion}' no válida.`);
    }

    if (modulo && modulo !== "animales") {
      let q = admin
        .from("historial_sistema")
        .select(SELECT_SISTEMA, { count: "exact" })
        .eq("granja_id", granjaId)
        .eq("modulo", modulo)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (referencia?.trim()) q = q.ilike("referencia", `%${referencia.trim()}%`);
      if (registroId) q = q.eq("registro_id", registroId);
      if (accion) q = q.eq("accion", accion);
      if (desde) q = q.gte("created_at", `${desde}T00:00:00Z`);
      if (hasta) q = q.lte("created_at", `${hasta}T23:59:59Z`);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      const items = (data ?? []).map((row) =>
        mapHistorialToApi(normalizeRow(row as Record<string, unknown>))
      );
      return jsonOk({ items, total: count ?? items.length, limit, offset });
    }

    let q = admin
      .from("historial_sistema")
      .select(SELECT_SISTEMA, { count: "exact" })
      .eq("granja_id", granjaId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (referencia?.trim()) q = q.ilike("referencia", `%${referencia.trim()}%`);
    if (modulo) q = q.eq("modulo", modulo);
    if (registroId) q = q.eq("registro_id", registroId);
    if (accion) q = q.eq("accion", accion);
    if (desde) q = q.gte("created_at", `${desde}T00:00:00Z`);
    if (hasta) q = q.lte("created_at", `${hasta}T23:59:59Z`);

    let data: Record<string, unknown>[] | null = null;
    let error: { message: string } | null = null;
    let count: number | null = null;

    const primary = await q;
    data = (primary.data ?? []) as Record<string, unknown>[];
    error = primary.error;
    count = primary.count;

    if (error?.message.includes("historial_sistema")) {
      if (modulo && modulo !== "animales") {
        return jsonError(
          "Ejecute docs/database/historial-sistema.sql en Supabase para activar el libro de actas.",
          503
        );
      }
      let lq = admin
        .from("historial_animales")
        .select(SELECT_LEGACY, { count: "exact" })
        .eq("granja_id", granjaId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (referencia?.trim()) lq = lq.ilike("arete", `%${referencia.trim()}%`);
      if (registroId) lq = lq.eq("animal_id", registroId);
      if (accion) lq = lq.eq("accion", accion);
      if (desde) lq = lq.gte("created_at", `${desde}T00:00:00Z`);
      if (hasta) lq = lq.lte("created_at", `${hasta}T23:59:59Z`);
      const legacy = await lq;
      data = (legacy.data ?? []) as Record<string, unknown>[];
      error = legacy.error;
      count = legacy.count;
    }

    if (error) throw new Error(error.message);

    const items = data.map((row) => mapHistorialToApi(normalizeRow(row)));

    return jsonOk({ items, total: count ?? items.length, limit, offset });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (msg.includes("historial_sistema") || msg.includes("does not exist")) {
      return jsonError(
        "Ejecute docs/database/historial-sistema.sql en Supabase para activar el libro de actas.",
        503
      );
    }
    return jsonServerError("historial", e);
  }
}
