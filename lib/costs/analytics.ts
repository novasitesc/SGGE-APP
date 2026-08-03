import type { Cost } from "@/lib/types/domain";
import {
  costCategoryLabel,
  COST_CATEGORY_CHART_COLOR,
  normalizeCostCategoryKey,
  type CostCategoryKey,
} from "@/lib/costs/categories";
import {
  daysInclusive,
  endOfMonthISO,
  isDateInRange,
  previousPeriodRange,
  startOfMonthISO,
  toISODateLocal,
  type DateRange,
} from "@/lib/costs/period";

export type CostMonthBucket = {
  month: string;
  label: string;
  amount: number;
};

export type CostProjection = {
  periodTotal: number;
  previousTotal: number;
  deltaPct: number | null;
  dailyAvg: number;
  projectedMonthEnd: number;
  monthToDate: number;
  daysElapsedInMonth: number;
  daysInMonth: number;
  topCategoryKey: CostCategoryKey | null;
  topCategoryAmount: number;
  fromInvoiceCount: number;
  recordCount: number;
};

const MONTH_LABELS = [
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

export function filterCostsByRange(costs: Cost[], range: DateRange): Cost[] {
  if (!range.from && !range.to) return costs;
  return costs.filter((c) => isDateInRange(c.date, range));
}

export function sumAmounts(costs: Cost[]): number {
  return costs.reduce((s, c) => s + c.amount, 0);
}

/** Totales por clave de categoría UI. */
export function totalsByCategoryKey(costs: Cost[]): Map<CostCategoryKey, number> {
  const map = new Map<CostCategoryKey, number>();
  for (const c of costs) {
    const key = normalizeCostCategoryKey(c.category);
    map.set(key, (map.get(key) ?? 0) + c.amount);
  }
  return map;
}

export function aggregateCostsByMonth(
  costs: Cost[],
  monthsBack = 12,
  ref: Date = new Date()
): CostMonthBucket[] {
  const buckets: CostMonthBucket[] = [];
  const keyToIndex = new Map<string, number>();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keyToIndex.set(key, buckets.length);
    buckets.push({
      month: key,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      amount: 0,
    });
  }

  for (const c of costs) {
    const key = c.date.slice(0, 7);
    const idx = keyToIndex.get(key);
    if (idx != null) buckets[idx].amount += c.amount;
  }

  return buckets.map((b) => ({
    ...b,
    amount: Math.round(b.amount * 100) / 100,
  }));
}

export function chartRowsFromCategoryTotals(
  totals: Map<CostCategoryKey, number>
): { category: string; amount: number; color: string }[] {
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const category = costCategoryLabel(key);
      return {
        category,
        amount: Math.round(amount * 100) / 100,
        color: COST_CATEGORY_CHART_COLOR[category] ?? "#6b7280",
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function computeCostProjection(
  allCosts: Cost[],
  periodCosts: Cost[],
  range: DateRange,
  ref: Date = new Date()
): CostProjection {
  const periodTotal = sumAmounts(periodCosts);
  const prevRange = previousPeriodRange(range, ref);
  const previousTotal =
    prevRange.from && prevRange.to
      ? sumAmounts(filterCostsByRange(allCosts, prevRange))
      : 0;

  let deltaPct: number | null = null;
  if (previousTotal > 0) {
    deltaPct = ((periodTotal - previousTotal) / previousTotal) * 100;
  } else if (periodTotal > 0 && (range.from || range.to)) {
    deltaPct = null;
  }

  const today = toISODateLocal(ref);
  const from = range.from ?? (periodCosts.length ? periodCosts[periodCosts.length - 1]!.date : today);
  const to = range.to ?? today;
  const dayCount = daysInclusive(from, to);
  const dailyAvg = periodTotal / dayCount;

  const monthStart = startOfMonthISO(ref);
  const monthEnd = endOfMonthISO(ref);
  const monthCosts = filterCostsByRange(allCosts, { from: monthStart, to: today });
  const monthToDate = sumAmounts(monthCosts);
  const daysElapsedInMonth = daysInclusive(monthStart, today);
  const daysInMonth = daysInclusive(monthStart, monthEnd);
  const projectedMonthEnd =
    daysElapsedInMonth > 0
      ? (monthToDate / daysElapsedInMonth) * daysInMonth
      : monthToDate;

  const catTotals = totalsByCategoryKey(periodCosts);
  let topCategoryKey: CostCategoryKey | null = null;
  let topCategoryAmount = 0;
  for (const [key, amount] of catTotals) {
    if (amount > topCategoryAmount) {
      topCategoryKey = key;
      topCategoryAmount = amount;
    }
  }

  return {
    periodTotal: Math.round(periodTotal * 100) / 100,
    previousTotal: Math.round(previousTotal * 100) / 100,
    deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
    monthToDate: Math.round(monthToDate * 100) / 100,
    daysElapsedInMonth,
    daysInMonth,
    topCategoryKey,
    topCategoryAmount: Math.round(topCategoryAmount * 100) / 100,
    fromInvoiceCount: periodCosts.filter((c) => c.source === "comprobante").length,
    recordCount: periodCosts.length,
  };
}
