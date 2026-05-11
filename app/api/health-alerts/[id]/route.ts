import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId, isUuid } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAlertRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as { resolved?: boolean };

    if (body.resolved === true) {
      const { data, error } = await admin
        .from("health_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("farm_id", farmId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) return jsonError(error.message, 400);
      if (!data) return jsonError("Alerta no encontrada.", 404);
      return jsonOk(mapAlertRow(data));
    }

    return jsonError("Solo se admite { resolved: true } por ahora.", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
