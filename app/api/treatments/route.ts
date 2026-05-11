import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapTreatmentRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const { data, error } = await admin
      .from("treatments")
      .select("*")
      .eq("farm_id", farmId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapTreatmentRow));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  type?: string;
  name?: string;
  date?: string;
  animalCount?: number;
  costPerAnimal?: number;
  totalCost?: number;
  appliedBy?: string;
  notes?: string;
  nextDue?: string | null;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    if (!body.type) return jsonError("type es obligatorio.");
    if (!body.name?.trim()) return jsonError("name es obligatorio.");
    if (!body.date) return jsonError("date es obligatorio.");
    if (body.animalCount == null || body.animalCount <= 0) {
      return jsonError("animalCount debe ser > 0.");
    }
    if (body.costPerAnimal == null || body.costPerAnimal < 0) {
      return jsonError("costPerAnimal inválido.");
    }

    const expected = Math.round(body.animalCount * body.costPerAnimal * 100) / 100;
    const totalCost =
      body.totalCost != null ? body.totalCost : expected;
    if (Math.abs(totalCost - expected) > 0.02) {
      return jsonError(
        `totalCost (${totalCost}) no coincide con animalCount × costPerAnimal (${expected}).`
      );
    }

    const insert = {
      farm_id: farmId,
      type: body.type,
      name: body.name.trim(),
      date: body.date,
      animal_count: body.animalCount,
      cost_per_animal: body.costPerAnimal,
      total_cost: totalCost,
      applied_by: body.appliedBy?.trim() ?? "",
      notes: body.notes?.trim() ?? "",
      next_due: body.nextDue ?? null,
    };

    const { data, error } = await admin
      .from("treatments")
      .insert(insert)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 400);
    return jsonOk(mapTreatmentRow(data), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
