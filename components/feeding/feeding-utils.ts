import type { FeedPurchaseHistoryItem } from "@/lib/api/data-client";
import type { FeedType } from "@/lib/types/domain";
import type { FeedingPeriodDays } from "@/lib/api/data-client";

export type FeedingMode = "resumen" | "compras" | "raciones";

export const PERIOD_OPTIONS: { value: FeedingPeriodDays; label: string }[] = [
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 180, label: "180 días" },
  { value: 365, label: "1 año" },
  { value: 730, label: "2 años" },
  { value: "all", label: "Todo" },
];

export const PURCHASE_BAR_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#ca8a04",
];

export function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

export function parsePeriodParam(raw: string | null): FeedingPeriodDays {
  if (raw === "all") return "all";
  const n = Number(raw);
  if ([30, 90, 180, 365, 730].includes(n)) return n as FeedingPeriodDays;
  return 30;
}

export function parseModeParam(raw: string | null): FeedingMode {
  if (raw === "compras" || raw === "raciones" || raw === "resumen") return raw;
  return "resumen";
}

export function buildCostByDate(rows: FeedPurchaseHistoryItem[]) {
  const names = [...new Set(rows.map((p) => p.alimentoNombre))].sort((a, b) =>
    a.localeCompare(b)
  );
  const byFecha = new Map<string, Record<string, number>>();
  for (const p of rows) {
    const row = byFecha.get(p.fecha) ?? { total: 0 };
    row[p.alimentoNombre] = (Number(row[p.alimentoNombre]) || 0) + p.costo;
    row.total = (Number(row.total) || 0) + p.costo;
    byFecha.set(p.fecha, row);
  }
  const points = [...byFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, vals]) => {
      const point: Record<string, string | number> = {
        fecha,
        label: formatFechaCorta(fecha),
        total: Math.round(Number(vals.total) * 100) / 100,
      };
      for (const name of names) {
        point[name] = Math.round((Number(vals[name]) || 0) * 100) / 100;
      }
      return point;
    });
  return { points, names };
}

export function buildCostByAlimento(rows: FeedPurchaseHistoryItem[]) {
  const map = new Map<string, number>();
  for (const p of rows) {
    map.set(p.alimentoNombre, (map.get(p.alimentoNombre) ?? 0) + p.costo);
  }
  return [...map.entries()]
    .map(([name, costo]) => ({
      name,
      costo: Math.round(costo * 100) / 100,
    }))
    .sort((a, b) => b.costo - a.costo);
}

export function filterFeedTypes(
  feedTypes: FeedType[],
  alimentoId: string,
  showInactive: boolean
): FeedType[] {
  let list = feedTypes;
  if (alimentoId !== "all") {
    list = list.filter((f) => f.id === alimentoId);
  }
  if (!showInactive) {
    list = list.filter(
      (f) => f.monthlyCost > 0 || f.dailyConsumption > 0 || (f.purchaseCount ?? 0) > 0
    );
  }
  return list;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
