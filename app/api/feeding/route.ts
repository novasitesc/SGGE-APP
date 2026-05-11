import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const [{ count: activeHead }, { data: feeds, error: e2 }] = await Promise.all([
      admin
        .from("animals")
        .select("id", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("status", "activo"),
      admin
        .from("feed_catalog")
        .select("*")
        .or(`farm_id.eq.${farmId},farm_id.is.null`)
        .order("sort_order", { ascending: true }),
    ]);
    if (e2) throw new Error(e2.message);

    const heads = activeHead ?? 0;
    const rows = feeds ?? [];
    const sumDaily = rows.reduce(
      (s, r: { daily_consumption: string | number }) =>
        s + Number(r.daily_consumption),
      0
    );

    const feedTypes = rows.map((r: Record<string, unknown>) => {
      const daily = Number(r.daily_consumption);
      const price = Number(r.price_per_unit);
      const monthlyAmount = daily * 30 * heads;
      const monthlyCost = monthlyAmount * price;
      const pct =
        sumDaily > 0 ? Math.round((daily / sumDaily) * 1000) / 10 : 0;
      return {
        id: r.id as string,
        name: r.name as string,
        unit: r.unit as string,
        dailyConsumption: daily,
        pricePerUnit: price,
        monthlyAmount: Math.round(monthlyAmount * 100) / 100,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        percentage: pct,
      };
    });

    return jsonOk({ activeHeadCount: heads, feedTypes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
