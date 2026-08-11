import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  countNotificacionesNoLeidas,
  listNotificacionesUsuario,
  markAllNotificacionesLeidas,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, usuario } = auth.ctx;
    if (!usuario?.id) return jsonError("Usuario no identificado.", 403);

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    const [items, unreadCount] = await Promise.all([
      listNotificacionesUsuario(admin, usuario.id, {
        unreadOnly,
        limit: 40,
      }),
      countNotificacionesNoLeidas(admin, usuario.id),
    ]);

    return jsonOk({ items, unreadCount });
  } catch (e) {
    return jsonServerError("notificaciones", e);
  }
}

/** Marca todas como leídas. */
export async function PATCH(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, usuario } = auth.ctx;
    if (!usuario?.id) return jsonError("Usuario no identificado.", 403);

    const body = (await req.json().catch(() => ({}))) as { all?: boolean };
    if (body.all) {
      await markAllNotificacionesLeidas(admin, usuario.id);
    }
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonServerError("notificaciones", e);
  }
}
