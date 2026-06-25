import { parseJson } from "@/lib/api/parse-json";
import type {
  Cost,
  CostByCategory,
  DashboardData,
  FeedType,
  HealthAlert,
  Module,
  MonthlyFinancial,
  Sale,
  Treatment,
  WeightRecord,
} from "@/lib/types/domain";

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  return parseJson<DashboardData>(res);
}

export async function fetchCosts(): Promise<Cost[]> {
  const res = await fetch("/api/costs", { cache: "no-store" });
  return parseJson<Cost[]>(res);
}

export async function createCost(data: {
  category: string;
  description: string;
  amount: number;
  date: string;
}): Promise<Cost> {
  const res = await fetch("/api/costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Cost>(res);
}

export async function updateCostApi(
  id: string,
  data: Partial<{ category: string; description: string; amount: number; date: string }>
): Promise<Cost> {
  const res = await fetch(`/api/costs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Cost>(res);
}

export async function deleteCostApi(id: string): Promise<void> {
  const res = await fetch(`/api/costs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar costo");
  }
}

export async function fetchSales(): Promise<Sale[]> {
  const res = await fetch("/api/sales", { cache: "no-store" });
  return parseJson<Sale[]>(res);
}

export async function fetchModules(): Promise<Module[]> {
  const res = await fetch("/api/modules", { cache: "no-store" });
  const list = await parseJson<
    {
      id: string;
      uuid?: string;
      name: string;
      type: Module["type"];
      capacity: number;
      animalCount: number;
      location?: string;
      supervisor?: string;
    }[]
  >(res);
  return list.map((m) => ({
    id: m.id,
    uuid: m.uuid,
    name: m.name,
    type: m.type,
    capacity: m.capacity,
    animalCount: m.animalCount,
  }));
}

export async function createModule(data: {
  code: string;
  name: string;
  type?: string;
  capacity: number;
}): Promise<Module> {
  const res = await fetch("/api/modules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const row = await parseJson<{
    id: string;
    uuid: string;
    name: string;
    type: Module["type"];
    capacity: number;
    animalCount: number;
  }>(res);
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    type: row.type,
    capacity: row.capacity,
    animalCount: row.animalCount,
  };
}

export async function updateModuleApi(
  uuid: string,
  data: Partial<{ name: string; type: string; capacity: number }>
): Promise<Module> {
  const res = await fetch(`/api/modules/${uuid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const row = await parseJson<{
    id: string;
    uuid: string;
    name: string;
    type: Module["type"];
    capacity: number;
    animalCount: number;
  }>(res);
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    type: row.type,
    capacity: row.capacity,
    animalCount: row.animalCount,
  };
}

export async function deleteModuleApi(uuid: string): Promise<void> {
  const res = await fetch(`/api/modules/${uuid}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar módulo");
  }
}

export async function fetchFeeding(): Promise<{
  activeHeadCount: number;
  feedTypes: FeedType[];
  periodDays: number;
  daysWithRecords: number;
  hasConsumptionRecords: boolean;
  totalDailyConsumption: number;
}> {
  const res = await fetch("/api/feeding", { cache: "no-store" });
  return parseJson<{
    activeHeadCount: number;
    feedTypes: FeedType[];
    periodDays: number;
    daysWithRecords: number;
    hasConsumptionRecords: boolean;
    totalDailyConsumption: number;
  }>(res);
}

export async function fetchTreatments(): Promise<Treatment[]> {
  const res = await fetch("/api/treatments", { cache: "no-store" });
  return parseJson<Treatment[]>(res);
}

export async function fetchHealthAlerts(): Promise<HealthAlert[]> {
  const res = await fetch("/api/health-alerts", { cache: "no-store" });
  return parseJson<HealthAlert[]>(res);
}

export async function fetchWeightHistory(): Promise<WeightRecord[]> {
  const res = await fetch("/api/weights/history", { cache: "no-store" });
  const data = await parseJson<{ weightHistory: WeightRecord[] }>(res);
  return data.weightHistory;
}

export async function fetchFinancialReports(): Promise<MonthlyFinancial[]> {
  const res = await fetch("/api/reports/financial", { cache: "no-store" });
  const data = await parseJson<{ monthlyFinancials: MonthlyFinancial[] }>(res);
  return data.monthlyFinancials;
}

export async function fetchGranjaInfo(): Promise<{ id: string; name: string }> {
  const res = await fetch("/api/granja", { cache: "no-store" });
  return parseJson<{ id: string; name: string }>(res);
}

export async function fetchRazas(): Promise<string[]> {
  const res = await fetch("/api/razas", { cache: "no-store" });
  return parseJson<string[]>(res);
}

/** Agrupa ventas por mes para gráficos. */
export function groupSalesByMonth(sales: Sale[]): { month: string; revenue: number }[] {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const buckets = new Map<string, number>();
  for (const s of sales) {
    const d = new Date(s.saleDate + "T12:00:00Z");
    const key = `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    buckets.set(key, (buckets.get(key) ?? 0) + s.totalRevenue);
  }
  return [...buckets.entries()].map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue * 100) / 100,
  }));
}

/** Agrupa costos por categoría con colores para gráficos. */
export function aggregateCostsByCategory(costs: Cost[]): CostByCategory[] {
  const colors: Record<string, string> = {
    Alimentación: "#16a34a",
    "Mano de Obra": "#2563eb",
    Transporte: "#d97706",
    Vacunas: "#7c3aed",
    Medicamentos: "#dc2626",
    Servicios: "#0891b2",
    Veterinaria: "#7c3aed",
    Otros: "#6b7280",
  };
  const labels: Record<string, string> = {
    alim: "Alimentación",
    mo: "Mano de Obra",
    trans: "Transporte",
    vet: "Veterinaria",
    comb: "Combustible",
    mant: "Mantenimiento",
    otro: "Otros",
    alimentación: "Alimentación",
    transporte: "Transporte",
    vacunas: "Vacunas",
    mano_de_obra: "Mano de Obra",
    servicios: "Servicios",
    medicamentos: "Medicamentos",
    otros: "Otros",
  };
  const map = new Map<string, number>();
  for (const c of costs) {
    const label = labels[c.category.toLowerCase()] ?? c.category;
    map.set(label, (map.get(label) ?? 0) + c.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
    color: colors[category] ?? "#6b7280",
  }));
}
