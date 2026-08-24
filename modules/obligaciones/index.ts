export * from "./types/obligaciones.types";
export {
  parseCreateEmpleado,
  parseCreateServicioPublico,
  parseCreatePoliza,
  parseCreatePolizaPago,
  parseCreateAporteCcss,
  parseCreateSalario,
  parseCreateViatico,
} from "./types/schemas";

export { listEmpleados } from "./queries/empleados";
export { listServiciosPublicos, getServicioPublico } from "./queries/servicios-publicos";
export { listPolizas, getPoliza } from "./queries/polizas";
export { listAportesCcss, getAporteCcss } from "./queries/ccss";
export { listSalarios, getSalario } from "./queries/salarios";
export { listViaticos, getViatico } from "./queries/viaticos";

export {
  createEmpleado,
  updateEmpleado,
  softDeleteEmpleado,
} from "./actions/empleados";
export {
  createServicioPublico,
  updateServicioPublico,
  softDeleteServicioPublico,
} from "./actions/servicios-publicos";
export {
  createPoliza,
  updatePoliza,
  softDeletePoliza,
  createPolizaPago,
  updatePolizaPago,
  softDeletePolizaPago,
} from "./actions/polizas";
export {
  createAporteCcss,
  updateAporteCcss,
  softDeleteAporteCcss,
} from "./actions/ccss";
export {
  createSalario,
  updateSalario,
  softDeleteSalario,
} from "./actions/salarios";
export {
  createViatico,
  updateViatico,
  softDeleteViatico,
} from "./actions/viaticos";

export { sincronizarObligacionDesdeGasto } from "./lib/sync";
export {
  anularDominioPorGasto,
  actualizarDominioPorGasto,
} from "./lib/gasto-link";
export {
  formatPeriodoLabel,
  extractNumeroPoliza,
  extractPeriodoCcss,
  inferTipoPoliza,
  inferTipoServicioPublico,
} from "./lib/parse-text";
export { destinoPorCategoria, DESTINO_POR_CATEGORIA } from "./lib/destinos";
