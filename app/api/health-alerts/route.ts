import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId, isUuid } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAlertRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const openOnly = url.searchParams.get("open") === "1";

    let q = admin
      .from("health_alerts")
      .select("*")
      .eq("farm_id", farmId)
      .order("due_date", { ascending: true });
    if (openOnly) q = q.is("resolved_at", null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapAlertRow));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  animalId?: string | null;
  tagId?: string | null;
  type?: string;
  message?: string;
  dueDate?: string;
  priority?: string;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    if (!body.type) return jsonError("type es obligatorio.");
    if (!body.message?.trim()) return jsonError("message es obligatorio.");
    if (!body.dueDate) return jsonError("dueDate es obligatorio.");
    if (!body.priority) return jsonError("priority es obligatorio.");

    let tagId: string | null = body.tagId?.trim() ?? null;
    let animalId: string | null = null;
    if (body.animalId) {
      if (!isUuid(body.animalId)) return jsonError("animalId inválido.");
      const { data: a } = await admin
        .from("animals")
        .select("id, tag_id")
        .eq("farm_id", farmId)
        .eq("id", body.animalId)
        .maybeSingle();
      if (!a) return jsonError("Animal no encontrado.", 404);
      animalId = a.id;
      tagId = tagId ?? a.tag_id;
    }

    const insert = {
      farm_id: farmId,
      animal_id: animalId,
      tag_id: tagId,
      type: body.type,
      message: body.message.trim(),
      due_date: body.dueDate,
      priority: body.priority,
    };

    const { data, error } = await admin
      .from("health_alerts")
      .insert(insert)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 400);
    return jsonOk(mapAlertRow(data), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
