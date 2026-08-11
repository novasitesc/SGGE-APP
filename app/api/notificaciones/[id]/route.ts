import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { markNotificacionLeida } from "@/modules/salud";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, usuario } = auth.ctx;
    if (!usuario?.id) return jsonError("Usuario no identificado.", 403);

    const { id } = await params;
    await markNotificacionLeida(admin, usuario.id, id);
    return jsonOk({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
