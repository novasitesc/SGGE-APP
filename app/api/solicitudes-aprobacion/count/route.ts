import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

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
