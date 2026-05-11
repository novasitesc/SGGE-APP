import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

function monthKeyFromDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${months[(m ?? 1) - 1]} ${y}`;
}

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const [{ data: costs }, { data: sales }] = await Promise.all([
      admin.from("costs").select("amount, date").eq("farm_id", farmId),
      admin.from("sales").select("total_revenue, sale_date").eq("farm_id", farmId),
    ]);

    const byMonth = new Map<
      string,
      { costs: number; revenue: number }
    >();

    for (const c of costs ?? []) {
      const key = monthKeyFromDate((c as { date: string }).date);
      const cur = byMonth.get(key) ?? { costs: 0, revenue: 0 };
      cur.costs += Number((c as { amount: number }).amount);
      byMonth.set(key, cur);
    }
    for (const s of sales ?? []) {
      const key = monthKeyFromDate((s as { sale_date: string }).sale_date);
      const cur = byMonth.get(key) ?? { costs: 0, revenue: 0 };
      cur.revenue += Number((s as { total_revenue: number }).total_revenue);
      byMonth.set(key, cur);
    }

    const monthlyFinancials = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: labelFromKey(key),
        costs: Math.round(v.costs * 100) / 100,
        revenue: Math.round(v.revenue * 100) / 100,
        profit: Math.round((v.revenue - v.costs) * 100) / 100,
      }));

    return jsonOk({ monthlyFinancials });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
