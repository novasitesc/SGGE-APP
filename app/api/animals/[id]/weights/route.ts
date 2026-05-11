import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId, isUuid } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type PostBody = {
  weightKg?: number;
  measuredAt?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    if (body.weightKg == null || body.weightKg <= 0) {
      return jsonError("weightKg debe ser > 0.");
    }

    const { data: animal, error: e0 } = await admin
      .from("animals")
      .select("id")
      .eq("farm_id", farmId)
      .eq("id", animalId)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const measuredAt = body.measuredAt ?? new Date().toISOString();

    const { data: row, error: e1 } = await admin
      .from("weight_measurements")
      .insert({
        animal_id: animalId,
        weight_kg: body.weightKg,
        measured_at: measuredAt,
      })
      .select("*")
      .single();
    if (e1) return jsonError(e1.message, 400);

    const { error: e2 } = await admin
      .from("animals")
      .update({ current_weight: body.weightKg })
      .eq("farm_id", farmId)
      .eq("id", animalId);
    if (e2) return jsonError(e2.message, 500);

    return jsonOk(
      {
        id: row.id,
        animalId: row.animal_id,
        weightKg: Number(row.weight_kg),
        measuredAt: row.measured_at,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
