import {
  esAdmin,
  esAprobador,
  esGerencia,
  requireApiContext,
} from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";

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
    return jsonServerError("session", e);
  }
}
