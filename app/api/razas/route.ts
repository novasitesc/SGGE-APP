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
      .from("razas")
      .select("nombre")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);

    const names = (data ?? []).map((r: { nombre: string }) => r.nombre);
    return jsonOk(names);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
