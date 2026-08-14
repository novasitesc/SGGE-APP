import {
  ESTADOS_POLIZA,
  TIPOS_APORTE_CCSS,
  TIPOS_POLIZA,
  TIPOS_SALARIO,
  TIPOS_SERVICIO_PUBLICO,
  type CreateAporteCcssInput,
  type CreateEmpleadoInput,
  type CreatePolizaInput,
  type CreatePolizaPagoInput,
  type CreateSalarioInput,
  type CreateServicioPublicoInput,
  type CreateViaticoInput,
  type EstadoPoliza,
  type TipoAporteCcss,
  type TipoPoliza,
  type TipoSalario,
  type TipoServicioPublico,
} from "./obligaciones.types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function asPeriodoCcss(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^\d{6}$/.test(t)) return t;
  const m = t.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}${m[2]}`;
  return null;
}

function isIn<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

export function parseCreateEmpleado(body: unknown): ValidationResult<CreateEmpleadoInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.nombre)) return { ok: false, error: "nombre es obligatorio." };
  return {
    ok: true,
    data: {
      nombre: b.nombre.trim(),
      apellido: asOptionalString(b.apellido),
      cedula: asOptionalString(b.cedula),
      puesto: asOptionalString(b.puesto),
      fechaIngreso: isIsoDate(b.fechaIngreso) ? b.fechaIngreso : null,
      activo: b.activo === false ? false : true,
    },
  };
}

export function parseCreateServicioPublico(
  body: unknown
): ValidationResult<CreateServicioPublicoInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isIn(b.tipo, TIPOS_SERVICIO_PUBLICO)) {
    return { ok: false, error: "tipo de servicio público inválido." };
  }
  if (!isNonEmptyString(b.proveedor)) {
    return { ok: false, error: "proveedor es obligatorio." };
  }
  if (!isIsoDate(b.fechaPago)) return { ok: false, error: "fechaPago es obligatoria." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser >= 0." };
  return {
    ok: true,
    data: {
      tipo: b.tipo as TipoServicioPublico,
      proveedor: b.proveedor.trim(),
      numeroCuenta: asOptionalString(b.numeroCuenta),
      periodoInicio: isIsoDate(b.periodoInicio) ? b.periodoInicio : null,
      periodoFin: isIsoDate(b.periodoFin) ? b.periodoFin : null,
      fechaPago: b.fechaPago,
      monto,
      concepto: asOptionalString(b.concepto),
    },
  };
}

export function parseCreatePoliza(body: unknown): ValidationResult<CreatePolizaInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.numeroPoliza)) {
    return { ok: false, error: "numeroPoliza es obligatorio." };
  }
  if (!isIn(b.tipo, TIPOS_POLIZA)) return { ok: false, error: "tipo de póliza inválido." };
  const prima = b.primaTotal == null ? null : asNumber(b.primaTotal);
  if (b.primaTotal != null && (prima == null || prima < 0)) {
    return { ok: false, error: "primaTotal inválida." };
  }
  const estado: EstadoPoliza = isIn(b.estado, ESTADOS_POLIZA) ? b.estado : "vigente";
  return {
    ok: true,
    data: {
      aseguradora: asOptionalString(b.aseguradora) ?? "INS",
      numeroPoliza: b.numeroPoliza.trim(),
      tipo: b.tipo as TipoPoliza,
      vigenciaDesde: isIsoDate(b.vigenciaDesde) ? b.vigenciaDesde : null,
      vigenciaHasta: isIsoDate(b.vigenciaHasta) ? b.vigenciaHasta : null,
      primaTotal: prima,
      estado,
      notas: asOptionalString(b.notas),
    },
  };
}

export function parseCreatePolizaPago(
  body: unknown
): ValidationResult<CreatePolizaPagoInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isIsoDate(b.fecha)) return { ok: false, error: "fecha es obligatoria." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser >= 0." };
  return {
    ok: true,
    data: {
      fecha: b.fecha,
      monto,
      periodoDesde: isIsoDate(b.periodoDesde) ? b.periodoDesde : null,
      periodoHasta: isIsoDate(b.periodoHasta) ? b.periodoHasta : null,
      concepto: asOptionalString(b.concepto),
    },
  };
}

export function parseCreateAporteCcss(
  body: unknown
): ValidationResult<CreateAporteCcssInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  const periodo = asPeriodoCcss(b.periodo);
  if (!periodo) return { ok: false, error: "periodo debe ser YYYYMM o YYYY-MM." };
  if (!isIn(b.tipo, TIPOS_APORTE_CCSS)) return { ok: false, error: "tipo de aporte inválido." };
  if (!isIsoDate(b.fechaPago)) return { ok: false, error: "fechaPago es obligatoria." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser >= 0." };
  return {
    ok: true,
    data: {
      periodo,
      tipo: b.tipo as TipoAporteCcss,
      numeroPatrono: asOptionalString(b.numeroPatrono),
      fechaPago: b.fechaPago,
      monto,
      concepto: asOptionalString(b.concepto),
    },
  };
}

export function parseCreateSalario(body: unknown): ValidationResult<CreateSalarioInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isIn(b.tipo, TIPOS_SALARIO)) return { ok: false, error: "tipo de salario inválido." };
  if (!isIsoDate(b.fechaPago)) return { ok: false, error: "fechaPago es obligatoria." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser >= 0." };
  const empleadoId = asOptionalString(b.empleadoId);
  const empleadoNombre = asOptionalString(b.empleadoNombre);
  if (!empleadoId && !empleadoNombre) {
    return { ok: false, error: "Indique empleado o un nombre." };
  }
  return {
    ok: true,
    data: {
      empleadoId,
      empleadoNombre,
      periodoInicio: isIsoDate(b.periodoInicio) ? b.periodoInicio : null,
      periodoFin: isIsoDate(b.periodoFin) ? b.periodoFin : null,
      tipo: b.tipo as TipoSalario,
      monto,
      fechaPago: b.fechaPago,
      concepto: asOptionalString(b.concepto),
    },
  };
}

export function parseCreateViatico(body: unknown): ValidationResult<CreateViaticoInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  const b = body as Record<string, unknown>;
  if (!isIsoDate(b.fecha)) return { ok: false, error: "fecha es obligatoria." };
  if (!isNonEmptyString(b.destino)) return { ok: false, error: "destino es obligatorio." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser >= 0." };
  const empleadoId = asOptionalString(b.empleadoId);
  const empleadoNombre = asOptionalString(b.empleadoNombre);
  if (!empleadoId && !empleadoNombre) {
    return { ok: false, error: "Indique empleado o un nombre." };
  }
  return {
    ok: true,
    data: {
      empleadoId,
      empleadoNombre,
      fecha: b.fecha,
      destino: b.destino.trim(),
      motivo: asOptionalString(b.motivo),
      monto,
    },
  };
}

export function parsePatchRecord(body: unknown): ValidationResult<Record<string, unknown>> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido." };
  return { ok: true, data: body as Record<string, unknown> };
}
