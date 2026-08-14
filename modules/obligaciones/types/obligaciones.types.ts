export type OrigenObligacion = "manual" | "comprobante";

export const TIPOS_SERVICIO_PUBLICO = [
  "electricidad",
  "agua",
  "telecomunicaciones",
  "internet",
  "otro",
] as const;
export type TipoServicioPublico = (typeof TIPOS_SERVICIO_PUBLICO)[number];

export const TIPOS_POLIZA = [
  "riesgos_trabajo",
  "vehiculo",
  "ganadero",
  "incendio",
  "otro",
] as const;
export type TipoPoliza = (typeof TIPOS_POLIZA)[number];

export const ESTADOS_POLIZA = ["vigente", "vencida", "cancelada"] as const;
export type EstadoPoliza = (typeof ESTADOS_POLIZA)[number];

export const TIPOS_APORTE_CCSS = [
  "cuota_obrero_patronal",
  "ivm",
  "sem",
  "otro",
] as const;
export type TipoAporteCcss = (typeof TIPOS_APORTE_CCSS)[number];

export const TIPOS_SALARIO = [
  "ordinario",
  "extraordinario",
  "aguinaldo",
  "liquidacion",
  "otro",
] as const;
export type TipoSalario = (typeof TIPOS_SALARIO)[number];

export const TIPO_SERVICIO_LABEL: Record<TipoServicioPublico, string> = {
  electricidad: "Electricidad",
  agua: "Agua",
  telecomunicaciones: "Telecomunicaciones",
  internet: "Internet",
  otro: "Otro",
};

export const TIPO_POLIZA_LABEL: Record<TipoPoliza, string> = {
  riesgos_trabajo: "Riesgos del trabajo",
  vehiculo: "Vehículo",
  ganadero: "Ganadero",
  incendio: "Incendio",
  otro: "Otro",
};

export const ESTADO_POLIZA_LABEL: Record<EstadoPoliza, string> = {
  vigente: "Vigente",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const TIPO_APORTE_CCSS_LABEL: Record<TipoAporteCcss, string> = {
  cuota_obrero_patronal: "Cuota obrero-patronal",
  ivm: "IVM",
  sem: "SEM",
  otro: "Otro",
};

export const TIPO_SALARIO_LABEL: Record<TipoSalario, string> = {
  ordinario: "Ordinario",
  extraordinario: "Extraordinario",
  aguinaldo: "Aguinaldo",
  liquidacion: "Liquidación",
  otro: "Otro",
};

export type Empleado = {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  puesto: string | null;
  fechaIngreso: string | null;
  activo: boolean;
};

export type CreateEmpleadoInput = {
  nombre: string;
  apellido?: string | null;
  cedula?: string | null;
  puesto?: string | null;
  fechaIngreso?: string | null;
  activo?: boolean;
};

export type ServicioPublico = {
  id: string;
  tipo: TipoServicioPublico;
  proveedor: string;
  numeroCuenta: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  fechaPago: string;
  monto: number;
  concepto: string;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenObligacion;
  fileName?: string | null;
};

export type CreateServicioPublicoInput = {
  tipo: TipoServicioPublico;
  proveedor: string;
  numeroCuenta?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  fechaPago: string;
  monto: number;
  concepto?: string | null;
};

export type PolizaPago = {
  id: string;
  polizaId: string;
  fecha: string;
  monto: number;
  periodoDesde: string | null;
  periodoHasta: string | null;
  concepto: string;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenObligacion;
  fileName?: string | null;
};

export type Poliza = {
  id: string;
  aseguradora: string;
  numeroPoliza: string;
  tipo: TipoPoliza;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  primaTotal: number | null;
  estado: EstadoPoliza;
  notas: string | null;
  totalPagado: number;
  pagosCount: number;
  ultimoPago: string | null;
  pagos: PolizaPago[];
};

export type CreatePolizaInput = {
  aseguradora?: string | null;
  numeroPoliza: string;
  tipo: TipoPoliza;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  primaTotal?: number | null;
  estado?: EstadoPoliza;
  notas?: string | null;
};

export type CreatePolizaPagoInput = {
  fecha: string;
  monto: number;
  periodoDesde?: string | null;
  periodoHasta?: string | null;
  concepto?: string | null;
};

export type AporteCcss = {
  id: string;
  periodo: string;
  tipo: TipoAporteCcss;
  numeroPatrono: string | null;
  fechaPago: string;
  monto: number;
  concepto: string;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenObligacion;
  fileName?: string | null;
};

export type CreateAporteCcssInput = {
  periodo: string;
  tipo: TipoAporteCcss;
  numeroPatrono?: string | null;
  fechaPago: string;
  monto: number;
  concepto?: string | null;
};

export type Salario = {
  id: string;
  empleadoId: string | null;
  empleadoNombre: string;
  periodoInicio: string | null;
  periodoFin: string | null;
  tipo: TipoSalario;
  monto: number;
  fechaPago: string;
  concepto: string;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenObligacion;
  fileName?: string | null;
};

export type CreateSalarioInput = {
  empleadoId?: string | null;
  empleadoNombre?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  tipo: TipoSalario;
  monto: number;
  fechaPago: string;
  concepto?: string | null;
};

export type Viatico = {
  id: string;
  empleadoId: string | null;
  empleadoNombre: string;
  fecha: string;
  destino: string;
  motivo: string | null;
  monto: number;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenObligacion;
  fileName?: string | null;
};

export type CreateViaticoInput = {
  empleadoId?: string | null;
  empleadoNombre?: string | null;
  fecha: string;
  destino: string;
  motivo?: string | null;
  monto: number;
};

export const OBLIGACION_CODIGOS = ["SPUB", "POL", "CCSS", "SAL", "VIAT"] as const;
export type ObligacionCodigo = (typeof OBLIGACION_CODIGOS)[number];
