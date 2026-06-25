export const MODULE_TYPE_OPTIONS = [
  { value: "engorda", label: "Engorda" },
  { value: "leche", label: "Leche" },
  { value: "cría", label: "Cría" },
  { value: "recría", label: "Recría" },
  { value: "cuarentena", label: "Cuarentena" },
  { value: "enfermeria", label: "Enfermería" },
] as const;

export const MODULE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const MODULE_TYPE_COLORS: Record<string, string> = {
  engorda: "bg-emerald-100 text-emerald-800",
  leche: "bg-blue-100 text-blue-800",
  cría: "bg-pink-100 text-pink-800",
  recría: "bg-amber-100 text-amber-800",
  cuarentena: "bg-orange-100 text-orange-800",
  enfermeria: "bg-red-100 text-red-800",
};

export function moduleTypeLabel(type: string): string {
  return MODULE_TYPE_LABELS[type] ?? type;
}

export function moduleTypeColor(type: string): string {
  return MODULE_TYPE_COLORS[type] ?? "bg-slate-100 text-slate-700";
}
