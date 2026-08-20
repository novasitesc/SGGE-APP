// ─── ANIMALS ────────────────────────────────────────────────────────────────

export type AnimalStatus = "activo" | "vendido" | "muerto" | "enfermo";

/** Origen del movimiento de compra (alineado a factura / remate). */
export type AcquisitionType = "subasta" | "particular" | "otro";

export interface Animal {
  id: string;
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: number;
  currentWeight: number;
  moduleId: string;
  /** Nombre legible del corral/módulo (corrales.nombre). */
  moduleName?: string;
  /** Lote de engorda (ciclo). Segmenta estadísticas de animales. */
  loteId?: string | null;
  status: AnimalStatus;
  sex: "M" | "H";
  age: number;
  acquisitionType?: AcquisitionType;
  invoiceFolio?: string;
  invoiceOrAuctionDate?: string;
  auctionLotNumber?: string;
  purchasePricePerKg?: number;
  purchaseTotalCost?: number;
}

// ─── MODULES ────────────────────────────────────────────────────────────────

export type ModuleType = "engorda" | "leche" | "cría" | "recría" | "cuarentena" | "enfermeria" | string;

export interface Module {
  id: string;
  uuid?: string;
  name: string;
  type: ModuleType;
  capacity: number;
  animalCount: number;
}

// ─── WEIGHT TRACKING ─────────────────────────────────────────────────────────

export interface WeightRecord {
  month: string;
  avgWeight: number;
  totalWeight: number;
}

// ─── COSTS ───────────────────────────────────────────────────────────────────

export type CostCategory =
  | "transporte"
  | "alimentación"
  | "fertilizantes"
  | "herbicidas"
  | "combustible"
  | "mantenimiento"
  | "vacunas"
  | "mano_de_obra"
  | "servicios"
  | "medicamentos"
  | "servicios_publicos"
  | "polizas"
  | "ccss"
  | "salarios"
  | "viaticos"
  | "otros";

export type CostSource = "manual" | "comprobante";

export interface Cost {
  id: string;
  category: CostCategory | string;
  description: string;
  amount: number;
  date: string;
  animalCount?: number;
  /** Origen del registro: alta manual o confirmación de factura. */
  source?: CostSource;
  issuer?: string | null;
  comprobanteId?: string | null;
  fileName?: string | null;
}

export interface CostByCategory {
  category: string;
  amount: number;
  color: string;
}

// ─── FEEDING ─────────────────────────────────────────────────────────────────

export type FeedPriceBasis = "unit" | "compra" | "none";

export interface FeedType {
  id: string;
  name: string;
  unit: string;
  dailyConsumption: number;
  /** Promedio: ₡/kg|und (unit) o ₡/compra (compra). */
  pricePerUnit: number;
  priceBasis?: FeedPriceBasis;
  /** Nº de facturas/compras en el período (si aplica). */
  purchaseCount?: number;
  monthlyAmount: number;
  monthlyCost: number;
  percentage: number;
}

// ─── HEALTH TREATMENTS ───────────────────────────────────────────────────────

export type TreatmentType =
  | "vacuna"
  | "desparasitante"
  | "implante"
  | "anabólico"
  | "estimulante"
  | "vitamina"
  | "antibiótico";

export interface Treatment {
  id: string;
  type: TreatmentType | string;
  name: string;
  date: string;
  animalId?: string | null;
  animalCount: number;
  costPerAnimal: number;
  totalCost: number;
  appliedBy: string;
  notes: string;
  nextDue?: string | null;
  status?: string;
  origen?: string;
  medicamentoId?: string | null;
  fechaFinCarencia?: string | null;
  listoTraslado?: boolean;
  diasCarencia?: number | null;
}

// ─── HEALTH ALERTS ───────────────────────────────────────────────────────────

export interface HealthAlert {
  id: string;
  animalId?: string | null;
  tagId?: string | null;
  type: "tratamiento" | "revisión" | "urgente" | "programado" | "carencia";
  message: string;
  dueDate: string;
  priority: "alta" | "media" | "baja";
  status?: "activa" | "resuelta" | "pospuesta";
  tratamientoId?: string | null;
}

// ─── SALES ───────────────────────────────────────────────────────────────────

export interface Sale {
  id: string;
  tagId: string;
  breed: string;
  finalWeight: number;
  pricePerKg: number;
  totalRevenue: number;
  saleDate: string;
  buyer: string;
  moduleId: string;
}

// ─── KPI / FINANCIAL SUMMARY ─────────────────────────────────────────────────

export interface KpiSummary {
  totalAnimals: number;
  activeAnimals: number;
  avgCurrentWeight: number;
  avgDailyGain: number;
  feedConversionRatio: number;
  costPerKg: number;
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
  profitability: number;
  feedCostApproxPerDay?: number;
}

// ─── WEIGHT DISTRIBUTION ─────────────────────────────────────────────────────

export interface WeightDistributionBucket {
  range: string;
  count: number;
  color: string;
}

// ─── MONTHLY FINANCIAL ───────────────────────────────────────────────────────

export interface MonthlyFinancial {
  month: string;
  costs: number;
  revenue: number;
  profit: number;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export interface DashboardData {
  kpiSummary: KpiSummary;
  recentAnimals: Animal[];
  recentSales: Sale[];
  healthAlerts: HealthAlert[];
  costsByCategory: CostByCategory[];
  /** Gastos/costos agregados a nivel granja (compartidos entre lotes). */
  costsSharedAcrossLotes?: boolean;
  loteId?: string | null;
}
