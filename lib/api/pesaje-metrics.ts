import type { PesajeRecord } from "@/components/animales/types";

export type PesajeRowMetrics = PesajeRecord & {
  /** Ganancia vs pesaje anterior (o peso inicial) */
  gainPeriodKg: number;
  /** Días entre este pesaje y el anterior (o ingreso) */
  periodDays: number;
  /** ADG del período: Δ kg / días período */
  adgPeriod: number | null;
  /** Días desde el ingreso a la finca */
  daysInFarm: number;
  /** Ganancia acumulada vs peso inicial */
  gainTotalKg: number;
  /** ADG acumulado desde ingreso */
  adgTotal: number | null;
};

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function buildPesajeMetrics(
  pesajes: PesajeRecord[],
  entryDate: string,
  initialWeight: number
): PesajeRowMetrics[] {
  const entry = entryDate.slice(0, 10);
  const sorted = [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return sorted.map((p, index) => {
    const fecha = p.fecha.slice(0, 10);
    const prevWeight = index === 0 ? initialWeight : sorted[index - 1].pesoKg;
    const prevDate = index === 0 ? entry : sorted[index - 1].fecha.slice(0, 10);

    const periodDays = Math.max(0, daysBetween(prevDate, fecha));
    const daysInFarm = Math.max(0, daysBetween(entry, fecha));
    const gainPeriodKg = round1(p.pesoKg - prevWeight);
    const gainTotalKg = round1(p.pesoKg - initialWeight);

    const adgPeriod =
      periodDays > 0 ? round3(gainPeriodKg / periodDays) : null;
    const adgTotal = daysInFarm > 0 ? round3(gainTotalKg / daysInFarm) : null;

    return {
      ...p,
      gainPeriodKg,
      periodDays,
      adgPeriod,
      daysInFarm,
      gainTotalKg,
      adgTotal,
    };
  });
}

export function formatGainKg(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

export function formatAdg(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value}`;
}
