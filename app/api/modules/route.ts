import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const [{ data: modules, error: e1 }, { data: animals, error: e2 }] =
      await Promise.all([
        admin
          .from("modules")
          .select("*")
          .eq("farm_id", farmId)
          .order("code", { ascending: true }),
        admin
          .from("animals")
          .select("id, module_id, status, current_weight")
          .eq("farm_id", farmId),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const list = (modules ?? []).map((m: Record<string, unknown>) => {
      const mid = m.id as string;
      const active = (animals ?? []).filter(
        (a: { module_id: string | null; status: string }) =>
          a.module_id === mid && a.status === "activo"
      );
      const avgWeight =
        active.length > 0
          ? Math.round(
              active.reduce(
                (s: number, a: { current_weight: number }) =>
                  s + Number(a.current_weight),
                0
              ) / active.length
            )
          : 0;
      return {
        id: m.code as string,
        uuid: mid,
        name: m.name,
        type: m.type,
        capacity: m.capacity,
        animalCount: active.length,
        location: m.location,
        supervisor: m.supervisor,
        avgWeightActive: avgWeight,
      };
    });

    return jsonOk(list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
