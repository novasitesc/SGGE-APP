import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const granjaId = await resolveGranjaId(
      admin,
      new URL(req.url).searchParams.get("farmId")
    );

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
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
