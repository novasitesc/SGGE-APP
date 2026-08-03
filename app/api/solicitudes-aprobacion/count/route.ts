
import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** Contador de pendientes: solo admin (quien autoriza). */
export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(auth.ctx.roles);
    if (denied) return jsonOk({ pending: 0 });
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const { count, error } = await admin
      .from("solicitudes_aprobacion")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .eq("estado", "pendiente");

    if (error) {
      if (
        error.message.includes("solicitudes_aprobacion") ||
        error.message.includes("does not exist")
      ) {
        return jsonOk({ pending: 0 });
      }
      throw new Error(error.message);
    }

    return jsonOk({ pending: count ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
