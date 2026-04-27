// ─── ANIMALS ────────────────────────────────────────────────────────────────

export type AnimalStatus = "activo" | "vendido" | "muerto" | "enfermo";

export interface Animal {
  id: string;
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: number;
  currentWeight: number;
  moduleId: string;
  status: AnimalStatus;
  sex: "M" | "H";
  age: number; // months
}

export const animals: Animal[] = [
  { id: "1", tagId: "BV-001", breed: "Angus", entryDate: "2024-10-01", initialWeight: 220, currentWeight: 385, moduleId: "M1", status: "activo", sex: "M", age: 18 },
  { id: "2", tagId: "BV-002", breed: "Simmental", entryDate: "2024-10-01", initialWeight: 235, currentWeight: 402, moduleId: "M1", status: "activo", sex: "M", age: 20 },
  { id: "3", tagId: "BV-003", breed: "Brahman", entryDate: "2024-10-05", initialWeight: 210, currentWeight: 358, moduleId: "M1", status: "activo", sex: "M", age: 17 },
  { id: "4", tagId: "BV-004", breed: "Charolais", entryDate: "2024-10-05", initialWeight: 245, currentWeight: 420, moduleId: "M2", status: "activo", sex: "M", age: 22 },
  { id: "5", tagId: "BV-005", breed: "Hereford", entryDate: "2024-10-10", initialWeight: 228, currentWeight: 375, moduleId: "M2", status: "activo", sex: "M", age: 19 },
  { id: "6", tagId: "BV-006", breed: "Angus", entryDate: "2024-10-10", initialWeight: 218, currentWeight: 340, moduleId: "M2", status: "enfermo", sex: "M", age: 16 },
  { id: "7", tagId: "BV-007", breed: "Simmental", entryDate: "2024-11-01", initialWeight: 230, currentWeight: 365, moduleId: "M3", status: "activo", sex: "M", age: 18 },
  { id: "8", tagId: "BV-008", breed: "Brahman", entryDate: "2024-11-01", initialWeight: 215, currentWeight: 348, moduleId: "M3", status: "activo", sex: "M", age: 17 },
  { id: "9", tagId: "BV-009", breed: "Charolais", entryDate: "2024-11-05", initialWeight: 250, currentWeight: 430, moduleId: "M3", status: "activo", sex: "M", age: 23 },
  { id: "10", tagId: "BV-010", breed: "Hereford", entryDate: "2024-11-05", initialWeight: 240, currentWeight: 410, moduleId: "M3", status: "activo", sex: "M", age: 21 },
  { id: "11", tagId: "BV-011", breed: "Angus", entryDate: "2024-11-10", initialWeight: 225, currentWeight: 355, moduleId: "M4", status: "activo", sex: "M", age: 18 },
  { id: "12", tagId: "BV-012", breed: "Brahman", entryDate: "2024-11-10", initialWeight: 212, currentWeight: 330, moduleId: "M4", status: "activo", sex: "M", age: 16 },
  { id: "13", tagId: "BV-013", breed: "Simmental", entryDate: "2024-12-01", initialWeight: 238, currentWeight: 360, moduleId: "M4", status: "activo", sex: "M", age: 17 },
  { id: "14", tagId: "BV-014", breed: "Charolais", entryDate: "2024-12-01", initialWeight: 255, currentWeight: 395, moduleId: "M4", status: "activo", sex: "M", age: 19 },
  { id: "15", tagId: "BV-015", breed: "Hereford", entryDate: "2024-12-05", initialWeight: 242, currentWeight: 388, moduleId: "M5", status: "activo", sex: "M", age: 20 },
  { id: "16", tagId: "BV-016", breed: "Angus", entryDate: "2024-12-05", initialWeight: 220, currentWeight: 312, moduleId: "M5", status: "activo", sex: "M", age: 15 },
  { id: "17", tagId: "BV-017", breed: "Brahman", entryDate: "2024-12-10", initialWeight: 208, currentWeight: 295, moduleId: "M5", status: "activo", sex: "M", age: 14 },
  { id: "18", tagId: "BV-018", breed: "Simmental", entryDate: "2025-01-05", initialWeight: 232, currentWeight: 280, moduleId: "M5", status: "activo", sex: "M", age: 13 },
  { id: "19", tagId: "BV-019", breed: "Charolais", entryDate: "2025-01-05", initialWeight: 260, currentWeight: 420, moduleId: "M1", status: "vendido", sex: "M", age: 24 },
  { id: "20", tagId: "BV-020", breed: "Hereford", entryDate: "2025-01-10", initialWeight: 235, currentWeight: 398, moduleId: "M1", status: "vendido", sex: "M", age: 21 },
];

// ─── MODULES ────────────────────────────────────────────────────────────────

export type ModuleType = "engorda" | "leche" | "cría" | "recría";

export interface Module {
  id: string;
  name: string;
  type: ModuleType;
  capacity: number;
  animalCount: number;
  location: string;
  supervisor: string;
}

export const modules: Module[] = [
  { id: "M1", name: "Módulo 1", type: "engorda", capacity: 20, animalCount: 6, location: "Norte A", supervisor: "Carlos López" },
  { id: "M2", name: "Módulo 2", type: "engorda", capacity: 20, animalCount: 3, location: "Norte B", supervisor: "Ana García" },
  { id: "M3", name: "Módulo 3", type: "engorda", capacity: 20, animalCount: 4, location: "Sur A", supervisor: "Roberto Silva" },
  { id: "M4", name: "Módulo 4", type: "engorda", capacity: 20, animalCount: 4, location: "Sur B", supervisor: "María Torres" },
  { id: "M5", name: "Módulo 5", type: "recría", capacity: 18, animalCount: 4, location: "Centro", supervisor: "José Martínez" },
];

// ─── WEIGHT TRACKING ─────────────────────────────────────────────────────────

export interface WeightRecord {
  month: string;
  avgWeight: number;
  totalWeight: number;
}

export const weightHistory: WeightRecord[] = [
  { month: "Oct 2024", avgWeight: 226, totalWeight: 4068 },
  { month: "Nov 2024", avgWeight: 268, totalWeight: 4824 },
  { month: "Dic 2024", avgWeight: 310, totalWeight: 5580 },
  { month: "Ene 2025", avgWeight: 344, totalWeight: 6192 },
  { month: "Feb 2025", avgWeight: 362, totalWeight: 6516 },
  { month: "Mar 2025", avgWeight: 378, totalWeight: 6804 },
  { month: "Abr 2025", avgWeight: 383, totalWeight: 6894 },
];

// ─── COSTS ───────────────────────────────────────────────────────────────────

export type CostCategory = "transporte" | "alimentación" | "vacunas" | "mano_de_obra" | "servicios" | "medicamentos" | "otros";

export interface Cost {
  id: string;
  category: CostCategory;
  description: string;
  amount: number;
  date: string;
  animalCount?: number;
}

export const costs: Cost[] = [
  { id: "C1", category: "transporte", description: "Flete de ganado lote octubre", amount: 8500, date: "2024-10-01", animalCount: 18 },
  { id: "C2", category: "alimentación", description: "Maíz molido - Octubre", amount: 14200, date: "2024-10-05" },
  { id: "C3", category: "vacunas", description: "Vacuna triple (IBR, DVB, PI3)", amount: 3600, date: "2024-10-07", animalCount: 18 },
  { id: "C4", category: "mano_de_obra", description: "Salario vaqueros - Octubre", amount: 9800, date: "2024-10-31" },
  { id: "C5", category: "servicios", description: "Agua y electricidad - Octubre", amount: 2100, date: "2024-10-31" },
  { id: "C6", category: "alimentación", description: "Sal mineral - Octubre", amount: 1850, date: "2024-10-15" },
  { id: "C7", category: "transporte", description: "Flete de ganado lote noviembre", amount: 7800, date: "2024-11-01", animalCount: 12 },
  { id: "C8", category: "alimentación", description: "Maíz molido - Noviembre", amount: 15400, date: "2024-11-05" },
  { id: "C9", category: "medicamentos", description: "Desparasitante oral", amount: 2200, date: "2024-11-10", animalCount: 18 },
  { id: "C10", category: "mano_de_obra", description: "Salario vaqueros - Noviembre", amount: 9800, date: "2024-11-30" },
  { id: "C11", category: "alimentación", description: "Melaza - Noviembre", amount: 3200, date: "2024-11-20" },
  { id: "C12", category: "vacunas", description: "Vitaminas ADE inyectable", amount: 1800, date: "2024-11-15", animalCount: 18 },
  { id: "C13", category: "alimentación", description: "Maíz molido - Diciembre", amount: 16100, date: "2024-12-05" },
  { id: "C14", category: "mano_de_obra", description: "Salario vaqueros - Diciembre", amount: 9800, date: "2024-12-31" },
  { id: "C15", category: "servicios", description: "Agua y electricidad - Diciembre", amount: 2300, date: "2024-12-31" },
  { id: "C16", category: "alimentación", description: "Maíz molido - Enero 2025", amount: 15800, date: "2025-01-05" },
  { id: "C17", category: "medicamentos", description: "Implante anabólico Revalor-G", amount: 4500, date: "2025-01-10", animalCount: 18 },
  { id: "C18", category: "mano_de_obra", description: "Salario vaqueros - Enero 2025", amount: 9800, date: "2025-01-31" },
  { id: "C19", category: "alimentación", description: "Urea - Enero 2025", amount: 1200, date: "2025-01-20" },
  { id: "C20", category: "servicios", description: "Agua y electricidad - Enero 2025", amount: 2150, date: "2025-01-31" },
];

export const costsByCategory = [
  { category: "Alimentación", amount: 67750, color: "#16a34a" },
  { category: "Mano de Obra", amount: 39200, color: "#2563eb" },
  { category: "Transporte", amount: 16300, color: "#d97706" },
  { category: "Vacunas", amount: 5400, color: "#7c3aed" },
  { category: "Medicamentos", amount: 6700, color: "#dc2626" },
  { category: "Servicios", amount: 6550, color: "#0891b2" },
  { category: "Otros", amount: 3200, color: "#6b7280" },
];

// ─── FEEDING ─────────────────────────────────────────────────────────────────

export interface FeedType {
  id: string;
  name: string;
  unit: string;
  dailyConsumption: number; // kg per animal per day
  pricePerUnit: number;
  monthlyAmount: number;
  monthlyCost: number;
  percentage: number;
}

export const feedTypes: FeedType[] = [
  { id: "F1", name: "Maíz Molido", unit: "kg", dailyConsumption: 6.5, pricePerUnit: 5.8, monthlyAmount: 3510, monthlyCost: 20358, percentage: 55 },
  { id: "F2", name: "Melaza", unit: "lt", dailyConsumption: 0.8, pricePerUnit: 4.2, monthlyAmount: 432, monthlyCost: 1814, percentage: 7 },
  { id: "F3", name: "Urea", unit: "kg", dailyConsumption: 0.1, pricePerUnit: 9.5, monthlyAmount: 54, monthlyCost: 513, percentage: 1 },
  { id: "F4", name: "Sal Mineral", unit: "kg", dailyConsumption: 0.15, pricePerUnit: 18.0, monthlyAmount: 81, monthlyCost: 1458, percentage: 3 },
  { id: "F5", name: "Forraje Seco", unit: "kg", dailyConsumption: 4.0, pricePerUnit: 2.5, monthlyAmount: 2160, monthlyCost: 5400, percentage: 20 },
  { id: "F6", name: "Concentrado Proteínico", unit: "kg", dailyConsumption: 1.2, pricePerUnit: 12.0, monthlyAmount: 648, monthlyCost: 7776, percentage: 14 },
];

// ─── HEALTH TREATMENTS ───────────────────────────────────────────────────────

export type TreatmentType = "vacuna" | "desparasitante" | "implante" | "anabólico" | "vitamina" | "antibiótico";

export interface Treatment {
  id: string;
  type: TreatmentType;
  name: string;
  date: string;
  animalCount: number;
  costPerAnimal: number;
  totalCost: number;
  appliedBy: string;
  notes: string;
  nextDue?: string;
}

export const treatments: Treatment[] = [
  { id: "T1", type: "vacuna", name: "Triple Viral (IBR, DVB, PI3)", date: "2024-10-07", animalCount: 18, costPerAnimal: 200, totalCost: 3600, appliedBy: "Dr. Hernández", notes: "Aplicar refuerzo en 21 días", nextDue: "2024-10-28" },
  { id: "T2", type: "desparasitante", name: "Ivermectina 1% inyectable", date: "2024-10-10", animalCount: 18, costPerAnimal: 85, totalCost: 1530, appliedBy: "Carlos López", notes: "Dosis subcutánea 1ml/50kg" },
  { id: "T3", type: "vitamina", name: "Vitaminas ADE", date: "2024-11-15", animalCount: 18, costPerAnimal: 100, totalCost: 1800, appliedBy: "Dr. Hernández", notes: "Refuerzo inmune mensual" },
  { id: "T4", type: "desparasitante", name: "Desparasitante oral (Albendazol)", date: "2024-11-10", animalCount: 18, costPerAnimal: 122, totalCost: 2200, appliedBy: "Carlos López", notes: "Control parasitario interno" },
  { id: "T5", type: "implante", name: "Implante Revalor-G", date: "2025-01-10", animalCount: 18, costPerAnimal: 250, totalCost: 4500, appliedBy: "Dr. Hernández", notes: "Implante anabólico, mejora GDP", nextDue: "2025-04-10" },
  { id: "T6", type: "vacuna", name: "Carbón Sintomático + Edema", date: "2024-12-01", animalCount: 18, costPerAnimal: 180, totalCost: 3240, appliedBy: "Dr. Hernández", notes: "Refuerzo anual obligatorio" },
  { id: "T7", type: "antibiótico", name: "Oxitetraciclina 200mg", date: "2025-02-05", animalCount: 3, costPerAnimal: 320, totalCost: 960, appliedBy: "Dr. Hernández", notes: "Tratamiento respiratorio BV-006, BV-011, BV-012" },
  { id: "T8", type: "desparasitante", name: "Ivermectina 1% inyectable", date: "2025-02-10", animalCount: 18, costPerAnimal: 85, totalCost: 1530, appliedBy: "Carlos López", notes: "Segundo ciclo desparasitación", nextDue: "2025-05-10" },
];

// ─── HEALTH ALERTS ───────────────────────────────────────────────────────────

export interface HealthAlert {
  id: string;
  animalId?: string;
  tagId?: string;
  type: "tratamiento" | "revisión" | "urgente" | "programado";
  message: string;
  dueDate: string;
  priority: "alta" | "media" | "baja";
}

export const healthAlerts: HealthAlert[] = [
  { id: "A1", tagId: "BV-006", type: "urgente", message: "Animal con signos respiratorios, requiere evaluación inmediata", dueDate: "2025-04-26", priority: "alta" },
  { id: "A2", type: "programado", message: "Aplicar 2do refuerzo implante Revalor-G (lote M1)", dueDate: "2025-04-10", priority: "alta" },
  { id: "A3", type: "programado", message: "Desparasitación masiva – ciclo trimestral", dueDate: "2025-05-10", priority: "media" },
  { id: "A4", type: "revisión", message: "Pesaje mensual general programado", dueDate: "2025-04-30", priority: "baja" },
  { id: "A5", type: "tratamiento", message: "Vitaminas ADE – 5 animales módulo 5 con bajo peso", dueDate: "2025-04-28", priority: "media" },
];

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

export const sales: Sale[] = [
  { id: "S1", tagId: "BV-019", breed: "Charolais", finalWeight: 420, pricePerKg: 48.5, totalRevenue: 20370, saleDate: "2025-03-10", buyer: "Rastro Municipal Norte", moduleId: "M1" },
  { id: "S2", tagId: "BV-020", breed: "Hereford", finalWeight: 398, pricePerKg: 47.0, totalRevenue: 18706, saleDate: "2025-03-10", buyer: "Rastro Municipal Norte", moduleId: "M1" },
  { id: "S3", tagId: "BV-004-OLD", breed: "Angus", finalWeight: 415, pricePerKg: 48.0, totalRevenue: 19920, saleDate: "2025-02-15", buyer: "Empacadora del Sur", moduleId: "M2" },
  { id: "S4", tagId: "BV-008-OLD", breed: "Brahman", finalWeight: 390, pricePerKg: 46.5, totalRevenue: 18135, saleDate: "2025-02-15", buyer: "Empacadora del Sur", moduleId: "M2" },
  { id: "S5", tagId: "BV-012-OLD", breed: "Simmental", finalWeight: 408, pricePerKg: 47.5, totalRevenue: 19380, saleDate: "2025-01-20", buyer: "Exportadora Ganadera SA", moduleId: "M3" },
];

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
}

export const kpiSummary: KpiSummary = {
  totalAnimals: 20,
  activeAnimals: 16,
  avgCurrentWeight: 374.2,
  avgDailyGain: 1.38,
  feedConversionRatio: 6.8,
  costPerKg: 38.4,
  totalCost: 145100,
  totalRevenue: 96511,
  netProfit: -48589,
  profitability: -33.5,
};

// ─── WEIGHT DISTRIBUTION ─────────────────────────────────────────────────────

export const weightDistribution = [
  { range: "< 300 kg", count: 3, color: "#ef4444" },
  { range: "300–349 kg", count: 4, color: "#f97316" },
  { range: "350–399 kg", count: 7, color: "#eab308" },
  { range: "400–449 kg", count: 4, color: "#22c55e" },
  { range: "≥ 450 kg", count: 0, color: "#16a34a" },
];

// ─── MONTHLY FINANCIAL ───────────────────────────────────────────────────────

export interface MonthlyFinancial {
  month: string;
  costs: number;
  revenue: number;
  profit: number;
}

export const monthlyFinancials: MonthlyFinancial[] = [
  { month: "Oct 2024", costs: 39050, revenue: 0, profit: -39050 },
  { month: "Nov 2024", costs: 41400, revenue: 0, profit: -41400 },
  { month: "Dic 2024", costs: 28100, revenue: 19380, profit: -8720 },
  { month: "Ene 2025", costs: 31250, revenue: 37515, profit: 6265 },
  { month: "Feb 2025", costs: 18100, revenue: 38041, profit: 19941 },
  { month: "Mar 2025", costs: 12400, revenue: 39076, profit: 26676 },
];
