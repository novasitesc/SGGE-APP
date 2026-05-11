import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapCostRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const { data, error } = await admin
      .from("costs")
      .select("*")
      .eq("farm_id", farmId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapCostRow));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  category?: string;
  description?: string;
  amount?: number;
  date?: string;
  animalCount?: number;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    if (!body.category) return jsonError("category es obligatorio.");
    if (!body.description?.trim()) return jsonError("description es obligatorio.");
    if (body.amount == null || body.amount < 0) {
      return jsonError("amount debe ser un número >= 0.");
    }
    if (!body.date) return jsonError("date es obligatorio.");

    const insert = {
      farm_id: farmId,
      category: body.category,
      description: body.description.trim(),
      amount: body.amount,
      date: body.date,
      animal_count: body.animalCount ?? null,
    };

    const { data, error } = await admin
      .from("costs")
      .insert(insert)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 400);
    return jsonOk(mapCostRow(data), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
