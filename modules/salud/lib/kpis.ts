import type { SaludKpis } from "../types/salud.types";

type TreatmentLike = {
  id: string;
  type: string;
  name: string;
  date: string;
  totalCost: number;
  nextDue?: string | null;
};

export function computeSaludKpis(
  treatments: TreatmentLike[]
): Omit<SaludKpis, "activeAlertsHigh"> {
  const vaccinesApplied = treatments.filter((t) => t.type === "vacuna").length;
  const totalCost = treatments.reduce((s, t) => s + t.totalCost, 0);

  const byType = new Map<string, number>();
  for (const t of treatments) {
    byType.set(String(t.type), (byType.get(String(t.type)) ?? 0) + t.totalCost);
  }
  const costByType = [...byType.entries()].map(([type, amount]) => ({
    type,
    amount,
  }));

  const byMonth = new Map<string, { count: number; cost: number }>();
  for (const t of treatments) {
    const month = (t.date ?? "").slice(0, 7);
    if (!month) continue;
    const cur = byMonth.get(month) ?? { count: 0, cost: 0 };
    cur.count += 1;
    cur.cost += t.totalCost;
    byMonth.set(month, cur);
  }
  const trendByMonth = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => ({ month, count: v.count, cost: v.cost }));

  const today = new Date().toISOString().slice(0, 10);
  const upcomingDue = treatments
    .filter((t) => t.nextDue && t.nextDue >= today)
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)))
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      name: t.name,
      nextDue: t.nextDue as string,
    }));

  return {
    treatmentsCount: treatments.length,
    vaccinesApplied,
    totalCost,
    costByType,
    trendByMonth,
    upcomingDue,
  };
}
