import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAnimalToApi, mapSaleRow, mapAlertRow, type AnimalRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

function daysBetween(startIso: string, end: Date): number {
  const a = new Date(startIso + "T12:00:00Z").getTime();
  const b = end.getTime();
  return Math.max(1, Math.round((b - a) / (86400 * 1000)));
}

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const [
      { data: animals, error: e1 },
      { data: modules },
      { data: costs },
      { data: sales },
      { data: alerts },
      { data: feeds },
    ] = await Promise.all([
      admin.from("animals").select("*").eq("farm_id", farmId),
      admin.from("modules").select("id, code").eq("farm_id", farmId),
      admin.from("costs").select("amount, category").eq("farm_id", farmId),
      admin.from("sales").select("*").eq("farm_id", farmId),
      admin
        .from("health_alerts")
        .select("*")
        .eq("farm_id", farmId)
        .is("resolved_at", null)
        .order("due_date", { ascending: true })
        .limit(10),
      admin
        .from("feed_catalog")
        .select("daily_consumption, price_per_unit")
        .or(`farm_id.eq.${farmId},farm_id.is.null`),
    ]);
    if (e1) throw new Error(e1.message);

    const codeById = new Map(
      (modules ?? []).map((m: { id: string; code: string }) => [m.id, m.code])
    );
    const list = animals ?? [];
    const active = list.filter((a: { status: string }) => a.status === "activo");
    const now = new Date();
    const totalAnimals = list.length;
    const activeAnimals = active.length;

    const avgCurrentWeight =
      activeAnimals > 0
        ? active.reduce(
            (s: number, a: { current_weight: number }) =>
              s + Number(a.current_weight),
            0
          ) / activeAnimals
        : 0;

    const gains = active.map((a: AnimalRow) => {
      const gain = Number(a.current_weight) - Number(a.initial_weight);
      const days = daysBetween(a.entry_date, now);
      return { gain, days, daily: gain / days };
    });
    const avgDailyGain =
      gains.length > 0
        ? gains.reduce((s, g) => s + g.daily, 0) / gains.length
        : 0;

    const totalGainKg = gains.reduce((s, g) => s + g.gain, 0);
    const totalCost = (costs ?? []).reduce(
      (s: number, c: { amount: number }) => s + Number(c.amount),
      0
    );
    const totalRevenue = (sales ?? []).reduce(
      (s: number, v: { total_revenue: number }) => s + Number(v.total_revenue),
      0
    );

    const feedSumDaily = (feeds ?? []).reduce(
      (s: number, r: { daily_consumption: number }) =>
        s + Number(r.daily_consumption),
      0
    );
    const feedCostApproxDay =
      activeAnimals > 0
        ? (feeds ?? []).reduce((s: number, r: Record<string, unknown>) => {
            const d = Number(r.daily_consumption);
            const p = Number(r.price_per_unit);
            return s + d * p * activeAnimals;
          }, 0)
        : 0;

    const feedConversionRatio =
      totalGainKg > 0 && feedSumDaily > 0 && activeAnimals > 0
        ? (feedSumDaily * activeAnimals * 30) / totalGainKg
        : 0;

    const costPerKg =
      totalGainKg > 0 ? totalCost / totalGainKg : totalCost;

    const netProfit = totalRevenue - totalCost;
    const profitability = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    const kpiSummary = {
      totalAnimals,
      activeAnimals,
      avgCurrentWeight: Math.round(avgCurrentWeight * 10) / 10,
      avgDailyGain: Math.round(avgDailyGain * 100) / 100,
      feedConversionRatio: Math.round(feedConversionRatio * 10) / 10,
      costPerKg: Math.round(costPerKg * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitability: Math.round(profitability * 10) / 10,
      feedCostApproxPerDay: Math.round(feedCostApproxDay * 100) / 100,
    };

    const recentAnimals = [...list]
      .sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5)
      .map((row) => mapAnimalToApi(row as AnimalRow, codeById));

    const recentSales = [...(sales ?? [])]
      .sort(
        (a: { sale_date: string }, b: { sale_date: string }) =>
          new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
      )
      .slice(0, 4)
      .map((row: Record<string, unknown>) =>
        mapSaleRow({
          id: String(row.id),
          tag_id: String(row.tag_id),
          breed: String(row.breed),
          final_weight: Number(row.final_weight),
          price_per_kg: Number(row.price_per_kg),
          total_revenue: Number(row.total_revenue),
          sale_date: String(row.sale_date),
          buyer: String(row.buyer),
          module_code: String(row.module_code),
        })
      );

    const healthAlerts = (alerts ?? []).map((row: Record<string, unknown>) =>
      mapAlertRow({
        id: String(row.id),
        animal_id: (row.animal_id as string | null) ?? null,
        tag_id: (row.tag_id as string | null) ?? null,
        type: String(row.type),
        message: String(row.message),
        due_date: String(row.due_date),
        priority: String(row.priority),
      })
    );

    const costsByCategoryMap = new Map<string, number>();
    const labels: Record<string, string> = {
      alimentación: "Alimentación",
      mano_de_obra: "Mano de Obra",
      transporte: "Transporte",
      vacunas: "Vacunas",
      medicamentos: "Medicamentos",
      servicios: "Servicios",
      otros: "Otros",
    };
    const colors: Record<string, string> = {
      Alimentación: "#16a34a",
      "Mano de Obra": "#2563eb",
      Transporte: "#d97706",
      Vacunas: "#7c3aed",
      Medicamentos: "#dc2626",
      Servicios: "#0891b2",
      Otros: "#6b7280",
    };
    for (const c of costs ?? []) {
      const cat = (c as { category: string }).category;
      const label = labels[cat] ?? cat;
      costsByCategoryMap.set(
        label,
        (costsByCategoryMap.get(label) ?? 0) + Number((c as { amount: number }).amount)
      );
    }
    const costsByCategory = [...costsByCategoryMap.entries()].map(
      ([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        color: colors[category] ?? "#6b7280",
      })
    );

    return jsonOk({
      kpiSummary,
      recentAnimals,
      recentSales,
      healthAlerts,
      costsByCategory,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
