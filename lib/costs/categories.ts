/**
 * Categorías de gasto unificadas (códigos DB ↔ claves UI ↔ labels).
 * Códigos de `categorias_gastos`: ALIM, COMB, MANT, SERV, TRANS, MO, VET,
 * SPUB, POL, CCSS, SAL, VIAT, FERT, HERB, OTRO.
 */

export type CostCategoryKey =
  | "alimentación"
  | "fertilizantes"
  | "herbicidas"
  | "combustible"
  | "mantenimiento"
  | "servicios"
  | "transporte"
  | "mano_de_obra"
  | "vacunas"
  | "medicamentos"
  | "servicios_publicos"
  | "polizas"
  | "ccss"
  | "salarios"
  | "viaticos"
  | "otros";

/** Código DB → clave UI estable. */
const CODIGO_TO_KEY: Record<string, CostCategoryKey> = {
  ALIM: "alimentación",
  FERT: "fertilizantes",
  HERB: "herbicidas",
  COMB: "combustible",
  MANT: "mantenimiento",
  SERV: "servicios",
  TRANS: "transporte",
  MO: "mano_de_obra",
  VET: "vacunas",
  SPUB: "servicios_publicos",
  POL: "polizas",
  CCSS: "ccss",
  SAL: "salarios",
  VIAT: "viaticos",
  OTRO: "otros",
  alim: "alimentación",
  fert: "fertilizantes",
  herb: "herbicidas",
  comb: "combustible",
  mant: "mantenimiento",
  serv: "servicios",
  trans: "transporte",
  mo: "mano_de_obra",
  vet: "vacunas",
  spub: "servicios_publicos",
  pol: "polizas",
  ccss: "ccss",
  sal: "salarios",
  viat: "viaticos",
  otro: "otros",
  otros: "otros",
  alimentación: "alimentación",
  alimentacion: "alimentación",
  fertilizantes: "fertilizantes",
  herbicidas: "herbicidas",
  combustible: "combustible",
  mantenimiento: "mantenimiento",
  servicios: "servicios",
  transporte: "transporte",
  mano_de_obra: "mano_de_obra",
  vacunas: "vacunas",
  medicamentos: "medicamentos",
  servicios_publicos: "servicios_publicos",
  polizas: "polizas",
  salarios: "salarios",
  viaticos: "viaticos",
};

export const COST_CATEGORY_LABEL: Record<CostCategoryKey, string> = {
  alimentación: "Alimentación",
  fertilizantes: "Abono y fertilizantes",
  herbicidas: "Herbicidas",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  servicios: "Servicios",
  transporte: "Transporte",
  mano_de_obra: "Mano de Obra",
  vacunas: "Veterinaria",
  medicamentos: "Medicamentos",
  servicios_publicos: "Servicios públicos",
  polizas: "Pólizas",
  ccss: "CCSS",
  salarios: "Salarios",
  viaticos: "Viáticos",
  otros: "Otros",
};

export const COST_CATEGORY_COLOR: Record<CostCategoryKey, string> = {
  alimentación: "bg-emerald-100 text-emerald-700",
  fertilizantes: "bg-lime-100 text-lime-800",
  herbicidas: "bg-green-100 text-green-800",
  combustible: "bg-amber-100 text-amber-800",
  mantenimiento: "bg-slate-100 text-slate-700",
  servicios: "bg-cyan-100 text-cyan-700",
  transporte: "bg-orange-100 text-orange-700",
  mano_de_obra: "bg-blue-100 text-blue-700",
  vacunas: "bg-purple-100 text-purple-700",
  medicamentos: "bg-red-100 text-red-700",
  servicios_publicos: "bg-sky-100 text-sky-800",
  polizas: "bg-indigo-100 text-indigo-800",
  ccss: "bg-teal-100 text-teal-800",
  salarios: "bg-blue-100 text-blue-800",
  viaticos: "bg-fuchsia-100 text-fuchsia-800",
  otros: "bg-slate-100 text-slate-600",
};

export const COST_CATEGORY_CHART_COLOR: Record<string, string> = {
  Alimentación: "#16a34a",
  "Abono y fertilizantes": "#65a30d",
  Herbicidas: "#15803d",
  Combustible: "#d97706",
  Mantenimiento: "#64748b",
  Servicios: "#0891b2",
  Transporte: "#ea580c",
  "Mano de Obra": "#2563eb",
  Veterinaria: "#7c3aed",
  Medicamentos: "#dc2626",
  "Servicios públicos": "#0369a1",
  Pólizas: "#4338ca",
  CCSS: "#0f766e",
  Salarios: "#1d4ed8",
  Viáticos: "#a21caf",
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

/**
 * Claves para alta/edición: una sola entrada Veterinaria (DB: VET).
 * Evita vacunas + medicamentos que colapsan al mismo código.
 */
export const COST_FORM_CATEGORY_KEYS: CostCategoryKey[] = [
  "alimentación",
  "fertilizantes",
  "herbicidas",
  "combustible",
  "mantenimiento",
  "servicios",
  "servicios_publicos",
  "transporte",
  "mano_de_obra",
  "salarios",
  "viaticos",
  "polizas",
  "ccss",
  "vacunas",
  "otros",
];

/** Clave UI / legacy → código DB (`categorias_gastos.codigo`). */
export const CATEGORIA_CODIGO_MAP: Record<string, string> = {
  alimentación: "ALIM",
  alimentacion: "ALIM",
  fertilizantes: "FERT",
  herbicidas: "HERB",
  combustible: "COMB",
  mantenimiento: "MANT",
  transporte: "TRANS",
  mano_de_obra: "MO",
  vacunas: "VET",
  medicamentos: "VET",
  servicios: "SERV",
  servicios_publicos: "SPUB",
  polizas: "POL",
  ccss: "CCSS",
  salarios: "SAL",
  viaticos: "VIAT",
  otros: "OTRO",
  alim: "ALIM",
  fert: "FERT",
  herb: "HERB",
  comb: "COMB",
  mant: "MANT",
  trans: "TRANS",
  mo: "MO",
  vet: "VET",
  serv: "SERV",
  spub: "SPUB",
  pol: "POL",
  sal: "SAL",
  viat: "VIAT",
  otro: "OTRO",
};

/** Resuelve cualquier entrada de categoría a código DB. */
export function resolveCategoriaCodigo(category: string): string {
  const lower = category.trim().toLowerCase();
  const key = normalizeCostCategoryKey(category);
  return (
    CATEGORIA_CODIGO_MAP[lower] ??
    CATEGORIA_CODIGO_MAP[key] ??
    category.trim().toUpperCase()
  );
}
