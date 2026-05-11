import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type MonthBucket = { key: string; label: string; sum: number; n: number };

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
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
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const { data: animals } = await admin
      .from("animals")
      .select("id")
      .eq("farm_id", farmId);
    const ids = (animals ?? []).map((a: { id: string }) => a.id);
    if (ids.length === 0) return jsonOk({ weightHistory: [] as { month: string; avgWeight: number; totalWeight: number }[] });

    const { data: measurements, error } = await admin
      .from("weight_measurements")
      .select("animal_id, measured_at, weight_kg")
      .in("animal_id", ids)
      .order("measured_at", { ascending: true });
    if (error) throw new Error(error.message);

    const buckets = new Map<string, MonthBucket>();
    for (const m of measurements ?? []) {
      const d = new Date((m as { measured_at: string }).measured_at);
      const key = monthKey(d);
      const label = monthLabel(d);
      const w = Number((m as { weight_kg: number }).weight_kg);
      const cur = buckets.get(key) ?? { key, label, sum: 0, n: 0 };
      cur.sum += w;
      cur.n += 1;
      buckets.set(key, cur);
    }

    let series: { month: string; avgWeight: number; totalWeight: number }[] = [];
    if (buckets.size > 0) {
      series = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({
          month: v.label,
          avgWeight: Math.round((v.sum / v.n) * 10) / 10,
          totalWeight: Math.round(v.sum * 10) / 10,
        }));
    } else {
      const { data: act } = await admin
        .from("animals")
        .select("current_weight")
        .eq("farm_id", farmId)
        .eq("status", "activo");
      const list = act ?? [];
      const n = list.length;
      if (n > 0) {
        const total = list.reduce(
          (s: number, a: { current_weight: number }) =>
            s + Number(a.current_weight),
          0
        );
        const avg = Math.round((total / n) * 10) / 10;
        series = [
          {
            month: monthLabel(new Date()),
            avgWeight: avg,
            totalWeight: Math.round(total * 10) / 10,
          },
        ];
      }
    }

    return jsonOk({ weightHistory: series });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
