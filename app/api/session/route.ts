import {
  esAdmin,
  esAprobador,
  esGerencia,
  requireApiContext,
} from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/**
 * Sesión de negocio: roles y capacidades para la UI.
 * Admin autoriza; gerencia opera y solicita.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { usuario, granjaId, roles } = auth.ctx;

    return jsonOk({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        granjaId,
      },
      roles,
      capabilities: {
        isAdmin: esAdmin(roles),
        isGerencia: esGerencia(roles),
        canApprove: esAprobador(roles),
        canManageCatalogs: esAdmin(roles),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
