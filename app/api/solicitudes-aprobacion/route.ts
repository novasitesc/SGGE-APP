import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  mapSolicitudToApi,
  type SolicitudRow,
} from "@/lib/api/solicitudes-aprobacion";

export const dynamic = "force-dynamic";

const SELECT = "*";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const estado = url.searchParams.get("estado")?.trim() ?? "pendiente";
    const registroId = url.searchParams.get("registroId")?.trim();
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    let q = admin
      .from("solicitudes_aprobacion")
      .select(SELECT, { count: "exact" })
      .eq("granja_id", granjaId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (estado !== "todas") q = q.eq("estado", estado);
    if (registroId) q = q.eq("registro_id", registroId);

    const { data, error, count } = await q;
    if (error) {
      if (
        error.message.includes("solicitudes_aprobacion") ||
        error.message.includes("does not exist")
      ) {
        return jsonError(
          "Ejecute docs/database/solicitudes-aprobacion.sql en Supabase.",
          503
        );
      }
      throw new Error(error.message);
    }

    const items = (data ?? []).map((row) =>
      mapSolicitudToApi(row as SolicitudRow)
    );

    return jsonOk({ items, total: count ?? items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
