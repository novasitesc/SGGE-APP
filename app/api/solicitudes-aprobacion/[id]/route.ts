import { isUuid } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  mapSolicitudToApi,
  resolverSolicitud,
} from "@/lib/api/solicitudes-aprobacion";
import { aprobadorDesdeSesion } from "@/lib/api/aprobacion";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de solicitud inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario, roles } = auth.ctx;

    const body = (await req.json()) as {
      action?: string;
      notes?: string;
    };

    const action = body.action?.trim();
    if (action !== "aprobar" && action !== "rechazar") {
      return jsonError("Acción inválida. Use 'aprobar' o 'rechazar'.", 400);
    }

    const aprobacion = aprobadorDesdeSesion({
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      roles,
    });
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
    return jsonServerError("solicitudes-aprobacion/[id]", e);
  }
}
