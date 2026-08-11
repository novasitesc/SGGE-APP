/** Exports seguros para Client Components (sin Supabase admin). */
export * from "./types/salud.types";
export { computeSaludKpis } from "./lib/kpis";
export { computeCarencia, addDaysIso, CARENCIA_AVISO_DIAS } from "./lib/carencia";
export { TratamientoFormDialog } from "./components/TratamientoFormDialog";
export { AlertaFormDialog } from "./components/AlertaFormDialog";
export { ImportPdfDialog } from "./components/ImportPdfDialog";
export { SaludHelpPanel } from "./components/SaludHelpPanel";
export { ChartSalud } from "./components/ChartSalud";
export { AnimalSaludSection } from "./components/AnimalSaludSection";
