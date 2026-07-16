/**
 * Categorías de gasto unificadas (códigos DB ↔ claves UI ↔ labels).
 * Los códigos de `categorias_gastos` son: ALIM, COMB, MANT, SERV, TRANS, MO, VET, OTRO.
 */

export type CostCategoryKey =
  | "alimentación"
  | "combustible"
  | "mantenimiento"
  | "servicios"
  | "transporte"
  | "mano_de_obra"
  | "vacunas"
  | "medicamentos"
  | "otros";

/** Código DB → clave UI estable. */
const CODIGO_TO_KEY: Record<string, CostCategoryKey> = {
  ALIM: "alimentación",
  COMB: "combustible",
  MANT: "mantenimiento",
  SERV: "servicios",
  TRANS: "transporte",
  MO: "mano_de_obra",
  VET: "vacunas",
  OTRO: "otros",
  // aliases por si llega en minúsculas
  alim: "alimentación",
  comb: "combustible",
  mant: "mantenimiento",
  serv: "servicios",
  trans: "transporte",
  mo: "mano_de_obra",
  vet: "vacunas",
  otro: "otros",
  otros: "otros",
  alimentación: "alimentación",
  alimentacion: "alimentación",
  combustible: "combustible",
  mantenimiento: "mantenimiento",
  servicios: "servicios",
  transporte: "transporte",
  mano_de_obra: "mano_de_obra",
  vacunas: "vacunas",
  medicamentos: "medicamentos",
};

export const COST_CATEGORY_LABEL: Record<CostCategoryKey, string> = {
  alimentación: "Alimentación",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  servicios: "Servicios",
  transporte: "Transporte",
  mano_de_obra: "Mano de Obra",
  vacunas: "Veterinaria",
  medicamentos: "Medicamentos",
  otros: "Otros",
};

export const COST_CATEGORY_COLOR: Record<CostCategoryKey, string> = {
  alimentación: "bg-emerald-100 text-emerald-700",
  combustible: "bg-amber-100 text-amber-800",
  mantenimiento: "bg-slate-100 text-slate-700",
  servicios: "bg-cyan-100 text-cyan-700",
  transporte: "bg-orange-100 text-orange-700",
  mano_de_obra: "bg-blue-100 text-blue-700",
  vacunas: "bg-purple-100 text-purple-700",
  medicamentos: "bg-red-100 text-red-700",
  otros: "bg-slate-100 text-slate-600",
};

export const COST_CATEGORY_CHART_COLOR: Record<string, string> = {
  Alimentación: "#16a34a",
  Combustible: "#d97706",
  Mantenimiento: "#64748b",
  Servicios: "#0891b2",
  Transporte: "#ea580c",
  "Mano de Obra": "#2563eb",
  Veterinaria: "#7c3aed",
  Medicamentos: "#dc2626",
  Otros: "#6b7280",
};

/** Normaliza cualquier código/clave legacy a clave UI. */
export function normalizeCostCategoryKey(raw: string | null | undefined): CostCategoryKey {
  if (!raw) return "otros";
  const t = raw.trim();
  return CODIGO_TO_KEY[t] ?? CODIGO_TO_KEY[t.toUpperCase()] ?? CODIGO_TO_KEY[t.toLowerCase()] ?? "otros";
}

export function costCategoryLabel(raw: string | null | undefined): string {
  const key = normalizeCostCategoryKey(raw);
  return COST_CATEGORY_LABEL[key];
}

/** Claves usadas en formularios de gestión (orden de visualización). */
export const COST_CATEGORY_KEYS = Object.keys(COST_CATEGORY_LABEL) as CostCategoryKey[];
