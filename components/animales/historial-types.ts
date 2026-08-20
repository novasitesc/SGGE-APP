import type { HistorialAccion, HistorialModulo } from "@/lib/api/historial-sistema";
import { MODULO_LABELS } from "@/lib/api/historial-sistema";

export type { HistorialAccion, HistorialModulo };

export type HistorialEntry = {
  id: string;
  module: HistorialModulo;
  moduleLabel: string;
  recordId: string | null;
  reference: string;
  action: HistorialAccion;
  summary: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  userId: string | null;
  userName: string;
  createdAt: string;
  /** Compatibilidad vista animales */
  animalId?: string | null;
  tagId?: string;
};

export type HistorialFilters = {
  referencia: string;
  modulo: string;
  accion: string;
  desde: string;
  hasta: string;
};

export const ACTION_CONFIG: Record<
  HistorialAccion,
  { label: string; color: string; bg: string; border: string }
> = {
  crear: {
    label: "Alta",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  modificar: {
    label: "Modificación",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  eliminar: {
    label: "Eliminación",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  vender: {
    label: "Venta",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  pesaje: {
    label: "Pesaje",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  acta: {
    label: "Acta",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
};

export const MODULO_OPTIONS: { value: HistorialModulo | ""; label: string }[] = [
  { value: "", label: "Todos los módulos" },
  ...(Object.entries(MODULO_LABELS) as [HistorialModulo, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

export const EMPTY_HISTORIAL_FILTERS: HistorialFilters = {
  referencia: "",
  modulo: "",
  accion: "",
  desde: "",
  hasta: "",
};

export const MODULO_ICONS: Record<HistorialModulo, string> = {
  animales: "beef",
  modulos: "grid",
  ventas: "cart",
  costos: "coins",
  alimentacion: "wheat",
  bodega: "warehouse",
  salud: "heart",
  contabilidad: "ledger",
  servicios_publicos: "zap",
  polizas: "shield",
  ccss: "building",
  salarios: "wallet",
  viaticos: "map",
};
