import { isUuid } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  crearSolicitudEliminarAnimal,
  mapSolicitudToApi,
} from "@/lib/api/solicitudes-aprobacion";
import {
  validarDatosSolicitante,
  validarJustificacionEliminacion,
} from "@/lib/api/aprobacion";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const body = (await req.json()) as {
      justification?: string;
      requesterName?: string;
      requesterEmail?: string;
      requesterRole?: string;
    };

    const justificationError = validarJustificacionEliminacion(body.justification ?? "");
    if (justificationError) return jsonError(justificationError, 400);

    const solicitanteError = validarDatosSolicitante({
      nombre: body.requesterName,
      email: body.requesterEmail,
      cargo: body.requesterRole,
    });
    if (solicitanteError) return jsonError(solicitanteError, 400);

    const result = await crearSolicitudEliminarAnimal(admin, {
      granjaId,
      animalId: id,
      justificacion: body.justification!.trim(),
      solicitanteNombre: body.requesterName!.trim(),
      solicitanteEmail: body.requesterEmail,
      solicitanteCargo: body.requesterRole,
    });

    if (!result.ok) return jsonError(result.message, result.status);

    return jsonOk(mapSolicitudToApi(result.solicitud), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
