export * from "./types/salud.types";
export {
  parseCreateTreatment,
  parseUpdateTreatment,
  parseCreateAlert,
  parseUpdateAlert,
  parseCreateMedicamento,
} from "./types/schemas";

export {
  listTratamientos,
  getTratamientoById,
  listTratamientosByAnimal,
} from "./queries/tratamientos";
export { computeSaludKpis } from "./lib/kpis";
export { listAlertas, getAlertaById, countAlertasAltas } from "./queries/alertas";
export { listMedicamentos, findOrCreateMedicamento } from "./queries/medicamentos";
export {
  mapTreatment,
  mapAlert,
  mapMedicamento,
  snapshotTratamiento,
  snapshotAlerta,
} from "./queries/mappers";

export {
  createTratamiento,
  updateTratamiento,
  softDeleteTratamiento,
  createTratamientosBulk,
} from "./actions/tratamientos";
export {
  createAlerta,
  updateAlerta,
  softDeleteAlerta,
} from "./actions/alertas";
export {
  createMedicamento,
  softDeleteMedicamento,
} from "./actions/medicamentos";
export {
  syncCarenciaYNotificaciones,
  notifyCarenciaInscrita,
  listNotificacionesUsuario,
  countNotificacionesNoLeidas,
  markNotificacionLeida,
  markAllNotificacionesLeidas,
} from "./actions/notificaciones";
export type { NotificacionUsuario } from "./actions/notificaciones";
export { computeCarencia, addDaysIso, CARENCIA_AVISO_DIAS } from "./lib/carencia";
