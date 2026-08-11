import { parseJson } from "@/lib/api/parse-json";
import {
  costCategoryLabel,
  COST_CATEGORY_CHART_COLOR,
} from "@/lib/costs/categories";
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

export async function fetchDashboard(
  loteId?: string | null
): Promise<DashboardData> {
  const qs = loteId ? `?loteId=${encodeURIComponent(loteId)}` : "";
  const res = await fetch(`/api/dashboard${qs}`, { cache: "no-store" });
  return parseJson<DashboardData>(res);
}

export type FetchCostsParams = {
  from?: string | null;
  to?: string | null;
};

export async function fetchCosts(params?: FetchCostsParams): Promise<Cost[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  const res = await fetch(q ? `/api/costs?${q}` : "/api/costs", {
    cache: "no-store",
  });
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

export async function createSale(data: {
  animalId?: string;
  tagId?: string;
  finalWeight: number;
  pricePerKg: number;
  saleDate: string;
  buyer: string;
}): Promise<Sale> {
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Sale>(res);
}

export async function updateSaleApi(
  id: string,
  data: Partial<{
    finalWeight: number;
    pricePerKg: number;
    saleDate: string;
    buyer: string;
  }>
): Promise<Sale> {
  const res = await fetch(`/api/sales/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Sale>(res);
}

export async function deleteSaleApi(id: string): Promise<void> {
  const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? "Error al eliminar venta"
    );
  }
}

export async function fetchModules(loteId?: string | null): Promise<Module[]> {
  const qs = loteId ? `?loteId=${encodeURIComponent(loteId)}` : "";
  const res = await fetch(`/api/modules${qs}`, { cache: "no-store" });
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

export type FeedPurchaseHistoryItem = {
  id: string;
  alimentacionId?: string;
  fecha: string;
  alimentoId: string;
  alimentoNombre: string;
  cantidad: number;
  unidad: string;
  costo: number;
  origen: string;
};

export type FeedDeliveryLine = {
  alimentoId: string;
  nombre: string;
  cantidad: number;
  subtotal: number;
};

export type FeedDeliveryHistoryItem = {
  id: string;
  fecha: string;
  costoTotal: number;
  observaciones: string | null;
  lineas: FeedDeliveryLine[];
};

export type FeedStockRow = {
  alimentoId: string;
  nombre: string;
  entradasKg: number;
  salidasKg: number;
  stockKg: number;
  entradasComprasSinKg: number;
  diasCobertura: number | null;
  costoCompras?: number;
  desdePdf?: boolean;
};

export type FeedAlert = {
  id: string;
  tone: "warning" | "danger" | "info";
  title: string;
  message: string;
  href?: string;
};

export type FeedingResponse = {
  activeHeadCount: number;
  feedTypes: FeedType[];
  periodDays: number;
  daysWithRecords: number;
  hasConsumptionRecords: boolean;
  totalDailyConsumption: number;
  purchaseCount?: number;
  purchaseCostPeriod?: number;
  periodFrom?: string;
  allTime?: boolean;
  totalsFromAllCompras?: boolean;
  purchaseHistory?: FeedPurchaseHistoryItem[];
  costByPurchaseDate?: Record<string, string | number>[];
  purchaseProductNames?: string[];
  deliveryHistory?: FeedDeliveryHistoryItem[];
  lastDelivery?: {
    fecha: string;
    lines: { alimentoId: string; cantidad: number }[];
  } | null;
  stockByAlimento?: FeedStockRow[];
  purchasesWithKgCount?: number;
  purchasesWithoutKgCount?: number;
  avgCostPerKg?: number;
  avgCostPerPurchase?: number;
  coveragePercent?: number | null;
  previousPurchaseCost?: number;
  previousCostByAlimento?: { name: string; costo: number }[];
  alerts?: FeedAlert[];
  lotes?: { id: string; nombre: string }[];
  racionCostPeriod?: number;
  costPerAnimalDayRacion?: number;
  porcionesEquitativas?: FeedPorcionEquitativa[];
  loteId?: string | null;
  comprasCompartidasGranja?: boolean;
};

export type FeedPorcionEquitativa = {
  alimentoId: string;
  nombre: string;
  origen: "racion" | "pdf_sugerido" | "pdf_sin_kg";
  totalKg: number;
  animalCount: number;
  kgPorAnimal: number;
  kgPorAnimalDia: number;
  kgHatoDia: number;
  stockKg: number;
  comprasSinKg: number;
  costoCompras: number;
};

export type FeedingPeriodDays = number | "all";

export async function fetchFeeding(
  days: FeedingPeriodDays = 30,
  loteId?: string | null
): Promise<FeedingResponse> {
  const params = new URLSearchParams();
  params.set("days", days === "all" ? "all" : String(days));
  if (loteId) params.set("loteId", loteId);
  const res = await fetch(`/api/feeding?${params.toString()}`, {
    cache: "no-store",
  });
  return parseJson<FeedingResponse>(res);
}

export async function updateCompraCantidadApi(data: {
  alimentacionId: string;
  alimentoId: string;
  cantidad: number;
}): Promise<{
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
  priceBasis: string;
}> {
  const res = await fetch("/api/feeding/compras", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export async function deleteFeedingDeliveryApi(id: string): Promise<void> {
  const res = await fetch("/api/feeding", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al anular entrega");
  }
}

export async function createAlimentoApi(data: {
  name: string;
  unit?: string;
  type?: string;
  pricePerUnit: number;
  code?: string;
}): Promise<{ id: string; name: string; pricePerUnit: number; unit: string }> {
  const res = await fetch("/api/alimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export async function updateAlimentoApi(
  id: string,
  data: Partial<{ name: string; unit: string; type: string; pricePerUnit: number }>
): Promise<{ id: string; name: string; pricePerUnit: number }> {
  const res = await fetch(`/api/alimentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export async function deleteAlimentoApi(id: string): Promise<void> {
  const res = await fetch(`/api/alimentos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar alimento");
  }
}

export async function createFeedingDeliveryApi(data: {
  fecha: string;
  observaciones?: string;
  loteId?: string;
  lines: { alimentoId: string; cantidad: number }[];
}): Promise<{ id: string; fecha: string; costoTotal: number; lineCount: number }> {
  const res = await fetch("/api/feeding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export type FetchTreatmentsParams = {
  from?: string | null;
  to?: string | null;
  type?: string | null;
  q?: string | null;
  animalId?: string | null;
};

export async function fetchTreatments(
  params?: FetchTreatmentsParams
): Promise<Treatment[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.type) qs.set("type", params.type);
  if (params?.q) qs.set("q", params.q);
  if (params?.animalId) qs.set("animalId", params.animalId);
  const q = qs.toString();
  const res = await fetch(q ? `/api/treatments?${q}` : "/api/treatments", {
    cache: "no-store",
  });
  return parseJson<Treatment[]>(res);
}

export async function createTreatmentApi(data: {
  type: string;
  name: string;
  date: string;
  animalCount: number;
  costPerAnimal: number;
  totalCost?: number;
  appliedBy?: string;
  notes?: string;
  nextDue?: string;
  animalId?: string;
  animalIds?: string[];
  medicamentoId?: string;
  loteId?: string;
  diasCarencia?: number;
  bulk?: boolean;
}): Promise<Treatment> {
  const res = await fetch("/api/treatments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Treatment>(res);
}

export async function updateTreatmentApi(
  id: string,
  data: Partial<{
    type: string;
    name: string;
    date: string;
    animalCount: number;
    costPerAnimal: number;
    totalCost: number;
    appliedBy: string;
    notes: string;
    nextDue: string;
    status: string;
    diasCarencia: number;
  }>
): Promise<Treatment> {
  const res = await fetch(`/api/treatments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Treatment>(res);
}

export async function deleteTreatmentApi(id: string): Promise<void> {
  const res = await fetch(`/api/treatments/${id}`, { method: "DELETE" });
  await parseJson(res);
}

export async function fetchHealthAlerts(all = false): Promise<HealthAlert[]> {
  const res = await fetch(
    all ? "/api/health-alerts?all=1" : "/api/health-alerts",
    { cache: "no-store" }
  );
  return parseJson<HealthAlert[]>(res);
}

export async function createHealthAlertApi(data: {
  type: string;
  message: string;
  dueDate: string;
  priority: string;
  tagId?: string;
  animalId?: string;
}): Promise<HealthAlert> {
  const res = await fetch("/api/health-alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<HealthAlert>(res);
}

export async function updateHealthAlertApi(
  id: string,
  data: Partial<{
    type: string;
    message: string;
    dueDate: string;
    priority: string;
    tagId: string;
    status: string;
  }>
): Promise<HealthAlert> {
  const res = await fetch(`/api/health-alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<HealthAlert>(res);
}

export async function deleteHealthAlertApi(id: string): Promise<void> {
  const res = await fetch(`/api/health-alerts/${id}`, { method: "DELETE" });
  await parseJson(res);
}

export async function fetchMedicamentos(): Promise<
  {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: string;
    pricePerUnit: number;
    active: boolean;
    periodoCarenciaDias: number;
    manualUso?: string | null;
  }[]
> {
  const res = await fetch("/api/medicamentos", { cache: "no-store" });
  return parseJson(res);
}

export async function createMedicamentoApi(data: {
  name: string;
  type?: string;
  unit?: string;
  pricePerUnit: number;
  code?: string;
  periodoCarenciaDias?: number;
  manualUso?: string;
}) {
  const res = await fetch("/api/medicamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export async function deleteMedicamentoApi(id: string): Promise<void> {
  const res = await fetch(`/api/medicamentos/${id}`, { method: "DELETE" });
  await parseJson(res);
}

export async function syncHealthAlertsApi(): Promise<{
  created: number;
  carenciaUpdated?: number;
  carenciaNotified?: number;
  carenciaAlerts?: number;
}> {
  const res = await fetch("/api/health-alerts/sync", { method: "POST" });
  return parseJson(res);
}

export type NotificacionInboxItem = {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  tratamientoId?: string | null;
  animalId?: string | null;
  fechaEvento?: string | null;
  leidaAt?: string | null;
  createdAt: string;
};

export async function fetchNotificacionesApi(unreadOnly = false): Promise<{
  items: NotificacionInboxItem[];
  unreadCount: number;
}> {
  const res = await fetch(
    unreadOnly ? "/api/notificaciones?unread=1" : "/api/notificaciones",
    { cache: "no-store" }
  );
  return parseJson(res);
}

export async function markNotificacionLeidaApi(id: string): Promise<void> {
  const res = await fetch(`/api/notificaciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await parseJson(res);
}

export async function markAllNotificacionesLeidasApi(): Promise<void> {
  const res = await fetch("/api/notificaciones", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true }),
  });
  await parseJson(res);
}

export async function uploadSaludPdfApi(file: File): Promise<{
  id: string;
  parsed: Record<string, unknown>;
}> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/salud/import", { method: "POST", body: fd });
  return parseJson(res);
}

export async function confirmSaludImportApi(
  id: string,
  overrides?: Record<string, unknown>
): Promise<Treatment> {
  const res = await fetch(`/api/salud/import/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides ?? {}),
  });
  return parseJson<Treatment>(res);
}

export async function fetchWeightHistory(
  loteId?: string | null
): Promise<WeightRecord[]> {
  const qs = loteId ? `?loteId=${encodeURIComponent(loteId)}` : "";
  const res = await fetch(`/api/weights/history${qs}`, { cache: "no-store" });
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

export type RazaAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
};

export async function fetchRazas(): Promise<string[]> {
  const res = await fetch("/api/razas", { cache: "no-store" });
  return parseJson<string[]>(res);
}

export async function fetchRazasAdmin(): Promise<RazaAdmin[]> {
  const res = await fetch("/api/razas?full=1", { cache: "no-store" });
  return parseJson<RazaAdmin[]>(res);
}

export async function createRaza(data: {
  nombre: string;
  codigo?: string;
}): Promise<RazaAdmin> {
  const res = await fetch("/api/razas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<RazaAdmin>(res);
}

export async function updateRazaApi(
  id: string,
  data: Partial<{ nombre: string; codigo: string; activa: boolean }>
): Promise<RazaAdmin> {
  const res = await fetch(`/api/razas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<RazaAdmin>(res);
}

// ─── Catálogos de administración ───────────────────────────────────────────

export type CategoriaAnimalAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  peso_min_kg: number | null;
  peso_max_kg: number | null;
  activa: boolean;
};

export async function fetchCategoriasAnimalesAdmin(): Promise<
  CategoriaAnimalAdmin[]
> {
  const res = await fetch("/api/categorias-animales", { cache: "no-store" });
  return parseJson<CategoriaAnimalAdmin[]>(res);
}

export async function createCategoriaAnimal(data: {
  nombre: string;
  codigo?: string;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
}): Promise<CategoriaAnimalAdmin> {
  const res = await fetch("/api/categorias-animales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<CategoriaAnimalAdmin>(res);
}

export async function updateCategoriaAnimalApi(
  id: string,
  data: Partial<{
    nombre: string;
    codigo: string;
    peso_min_kg: number | null;
    peso_max_kg: number | null;
    activa: boolean;
  }>
): Promise<CategoriaAnimalAdmin> {
  const res = await fetch(`/api/categorias-animales/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<CategoriaAnimalAdmin>(res);
}

export type EstadoAnimalAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export async function fetchEstadosAnimalesAdmin(): Promise<EstadoAnimalAdmin[]> {
  const res = await fetch("/api/estados-animales", { cache: "no-store" });
  return parseJson<EstadoAnimalAdmin[]>(res);
}

export async function createEstadoAnimal(data: {
  nombre: string;
  codigo?: string;
}): Promise<EstadoAnimalAdmin> {
  const res = await fetch("/api/estados-animales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<EstadoAnimalAdmin>(res);
}

export async function updateEstadoAnimalApi(
  id: string,
  data: Partial<{ nombre: string; codigo: string; activo: boolean }>
): Promise<EstadoAnimalAdmin> {
  const res = await fetch(`/api/estados-animales/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<EstadoAnimalAdmin>(res);
}

export type TipoCorralAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
  activo: boolean;
};

export async function fetchTiposCorralAdmin(): Promise<{
  items: TipoCorralAdmin[];
  fromDb: boolean;
}> {
  const res = await fetch("/api/tipos-corral", { cache: "no-store" });
  return parseJson<{ items: TipoCorralAdmin[]; fromDb: boolean }>(res);
}

export async function createTipoCorral(data: {
  nombre: string;
  codigo?: string;
  prefijo?: string;
}): Promise<TipoCorralAdmin> {
  const res = await fetch("/api/tipos-corral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<TipoCorralAdmin>(res);
}

export async function updateTipoCorralApi(
  id: string,
  data: Partial<{
    nombre: string;
    codigo: string;
    prefijo: string;
    activo: boolean;
  }>
): Promise<TipoCorralAdmin> {
  const res = await fetch(`/api/tipos-corral/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<TipoCorralAdmin>(res);
}

export type LoteAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
};

export async function fetchLotesAdmin(): Promise<LoteAdmin[]> {
  const res = await fetch("/api/lotes", { cache: "no-store" });
  return parseJson<LoteAdmin[]>(res);
}

export async function createLote(data: {
  nombre?: string;
  codigo?: string;
  estado?: string;
  fecha_apertura?: string;
}): Promise<LoteAdmin> {
  const res = await fetch("/api/lotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<LoteAdmin>(res);
}

export async function updateLoteApi(
  id: string,
  data: Partial<{
    nombre: string;
    codigo: string;
    estado: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
  }>
): Promise<LoteAdmin> {
  const res = await fetch(`/api/lotes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<LoteAdmin>(res);
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
  const map = new Map<string, number>();
  for (const c of costs) {
    const label = costCategoryLabel(c.category);
    map.set(label, (map.get(label) ?? 0) + c.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
    color: COST_CATEGORY_CHART_COLOR[category] ?? "#6b7280",
  }));
}
