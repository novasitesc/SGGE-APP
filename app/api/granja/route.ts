
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const { data, error } = await admin
      .from("granjas")
      .select("id, nombre")
      .eq("id", granjaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return jsonError("Granja no encontrada.", 404);

    return jsonOk({ id: data.id, name: data.nombre });
  } catch (e) {
    return jsonServerError("granja", e);
  }
}
