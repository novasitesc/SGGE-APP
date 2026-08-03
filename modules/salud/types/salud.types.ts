import type { TreatmentType } from "@/lib/types/domain";

export type { TreatmentType };

export type TreatmentOrigen = "manual" | "pdf" | "bulk";

export type AlertTipo = "tratamiento" | "revisión" | "urgente" | "programado";
export type AlertPrioridad = "alta" | "media" | "baja";
export type AlertEstado = "activa" | "resuelta" | "pospuesta";

export interface Medicamento {
  id: string;
  code: string;
  name: string;
  type: TreatmentType | string;
  unit: string;
  pricePerUnit: number;
  active: boolean;
}

export interface TreatmentRecord {
  id: string;
  type: TreatmentType | string;
  name: string;
  date: string;
  animalId?: string | null;
  animalIds?: string[];
  tagId?: string | null;
  medicamentoId?: string | null;
  animalCount: number;
  costPerAnimal: number;
  totalCost: number;
  appliedBy: string;
  notes: string;
  nextDue?: string | null;
  status: string;
  origen: TreatmentOrigen | string;
}

export interface HealthAlertRecord {
  id: string;
  animalId?: string | null;
  tagId?: string | null;
  type: AlertTipo;
  message: string;
  dueDate: string;
  priority: AlertPrioridad;
  status: AlertEstado;
  tratamientoId?: string | null;
}

export interface SaludKpis {
  treatmentsCount: number;
  activeAlertsHigh: number;
  vaccinesApplied: number;
  totalCost: number;
  costByType: { type: string; amount: number }[];
  trendByMonth: { month: string; count: number; cost: number }[];
  upcomingDue: { id: string; name: string; nextDue: string }[];
}

export interface CreateTreatmentInput {
  type: TreatmentType | string;
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
}

export interface UpdateTreatmentInput extends Partial<CreateTreatmentInput> {
  status?: string;
}

export interface CreateAlertInput {
  type: AlertTipo;
  message: string;
  dueDate: string;
  priority: AlertPrioridad;
  tagId?: string;
  animalId?: string;
  tratamientoId?: string;
}

export interface UpdateAlertInput extends Partial<CreateAlertInput> {
  status?: AlertEstado;
}

export interface CreateMedicamentoInput {
  code?: string;
  name: string;
  type?: string;
  unit?: string;
  pricePerUnit: number;
}

export interface ParsedSaludPdf {
  name?: string;
  type?: string;
  date?: string;
  appliedBy?: string;
  animalCount?: number;
  totalCost?: number;
  costPerAnimal?: number;
  notes?: string;
  nextDue?: string;
  rawText: string;
}

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
  vacuna: "Vacuna",
  desparasitante: "Desparasitante",
  implante: "Implante",
  anabólico: "Anabólico",
  vitamina: "Vitamina",
  antibiótico: "Antibiótico",
};

export const TREATMENT_TYPE_COLORS: Record<TreatmentType, string> = {
  vacuna: "bg-violet-100 text-violet-800",
  desparasitante: "bg-amber-100 text-amber-800",
  implante: "bg-sky-100 text-sky-800",
  anabólico: "bg-cyan-100 text-cyan-800",
  vitamina: "bg-lime-100 text-lime-800",
  antibiótico: "bg-rose-100 text-rose-800",
};

export const TREATMENT_TYPES = Object.keys(
  TREATMENT_TYPE_LABELS
) as TreatmentType[];
