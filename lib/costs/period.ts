/** Presets y helpers de periodo para filtros de costos. */

export type CostPeriodPreset =
  | "mes_actual"
  | "30d"
  | "90d"
  | "año"
  | "todo"
  | "custom";

export type DateRange = {
  from: string | null;
  to: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Fecha local YYYY-MM-DD. */
export function toISODateLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODateLocal(iso);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

export function daysInclusive(from: string, to: string): number {
  const a = parseISODateLocal(from).getTime();
  const b = parseISODateLocal(to).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function startOfMonthISO(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}-01`;
}

export function endOfMonthISO(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return toISODateLocal(d);
}

export const COST_PERIOD_PRESET_LABEL: Record<CostPeriodPreset, string> = {
  mes_actual: "Mes actual",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  año: "Año actual",
  todo: "Todo el historial",
  custom: "Personalizado",
};

/** Resuelve un preset a rango inclusive (YYYY-MM-DD). `todo` → sin filtro. */
export function resolvePeriodRange(
  preset: CostPeriodPreset,
  customFrom?: string,
  customTo?: string,
  ref: Date = new Date()
): DateRange {
  const today = toISODateLocal(ref);

  switch (preset) {
    case "mes_actual":
      return { from: startOfMonthISO(ref), to: today };
    case "30d":
      return { from: addDaysISO(today, -29), to: today };
    case "90d":
      return { from: addDaysISO(today, -89), to: today };
    case "año":
      return { from: `${ref.getFullYear()}-01-01`, to: today };
    case "todo":
      return { from: null, to: null };
    case "custom": {
      const from = customFrom?.trim() || null;
      const to = customTo?.trim() || null;
      if (from && to && from > to) return { from: to, to: from };
      return { from, to };
    }
  }
}

/** Periodo anterior de la misma duración, contiguo al actual. */
export function previousPeriodRange(range: DateRange, ref: Date = new Date()): DateRange {
  if (!range.from || !range.to) return { from: null, to: null };
  const len = daysInclusive(range.from, range.to);
  const prevTo = addDaysISO(range.from, -1);
  const prevFrom = addDaysISO(prevTo, -(len - 1));
  void ref;
  return { from: prevFrom, to: prevTo };
}

export function isDateInRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

/**
 * Amplía el rango de fetch para incluir periodo anterior y ~12 meses
 * (tendencia / proyección) sin traer todo el historial.
 */
export function expandFetchRange(
  range: DateRange,
  monthsBack = 12,
  ref: Date = new Date()
): DateRange {
  if (!range.from && !range.to) return { from: null, to: null };

  const today = toISODateLocal(ref);
  const to = range.to ?? today;
  const prev = previousPeriodRange(
    { from: range.from ?? to, to },
    ref
  );

  const trendStart = new Date(ref.getFullYear(), ref.getMonth() - (monthsBack - 1), 1);
  const trendFrom = toISODateLocal(trendStart);

  const candidates = [range.from, prev.from, trendFrom].filter(
    (v): v is string => !!v
  );
  const from = candidates.sort()[0] ?? null;

  return { from, to };
}
