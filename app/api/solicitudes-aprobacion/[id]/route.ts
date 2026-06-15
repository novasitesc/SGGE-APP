import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, isUuid } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  mapSolicitudToApi,
  resolverSolicitud,
} from "@/lib/api/solicitudes-aprobacion";
import { verificarAprobadorGerente } from "@/lib/api/aprobacion";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de solicitud inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const body = (await req.json()) as {
      action?: string;
      approverEmail?: string;
      approverPassword?: string;
      notes?: string;
    };

    const action = body.action?.trim();
    if (action !== "aprobar" && action !== "rechazar") {
      return jsonError("Acción inválida. Use 'aprobar' o 'rechazar'.", 400);
    }

    const aprobacion = await verificarAprobadorGerente(
      admin,
      body.approverEmail ?? "",
      body.approverPassword ?? ""
    );
    if (!aprobacion.ok) {
      return jsonError(aprobacion.message, 403);
    }

    const result = await resolverSolicitud(admin, {
      granjaId,
      solicitudId: id,
      accion: action,
      aprobador: aprobacion.aprobador,
      notas: body.notes,
    });

    if (!result.ok) return jsonError(result.message, result.status);

    const { data } = await admin
      .from("solicitudes_aprobacion")
      .select("*")
      .eq("id", id)
      .single();

    return jsonOk(mapSolicitudToApi(data));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
