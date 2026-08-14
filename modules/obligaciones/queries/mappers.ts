import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AporteCcss,
  Empleado,
  OrigenObligacion,
  Poliza,
  PolizaPago,
  Salario,
  ServicioPublico,
  TipoAporteCcss,
  TipoPoliza,
  TipoSalario,
  TipoServicioPublico,
  Viatico,
} from "../types/obligaciones.types";

export function asOrigen(v: unknown): OrigenObligacion {
  return v === "comprobante" ? "comprobante" : "manual";
}

export function mapEmpleado(row: Record<string, unknown>): Empleado {
  return {
    id: row.id as string,
    nombre: row.nombre as string,
    apellido: (row.apellido as string | null) ?? null,
    cedula: (row.cedula as string | null) ?? null,
    puesto: (row.puesto as string | null) ?? null,
    fechaIngreso: (row.fecha_ingreso as string | null) ?? null,
    activo: row.activo !== false,
  };
}

export function mapServicioPublico(
  row: Record<string, unknown>,
  fileName?: string | null
): ServicioPublico {
  return {
    id: row.id as string,
    tipo: row.tipo as TipoServicioPublico,
    proveedor: (row.proveedor as string) ?? "",
    numeroCuenta: (row.numero_cuenta as string | null) ?? null,
    periodoInicio: (row.periodo_inicio as string | null) ?? null,
    periodoFin: (row.periodo_fin as string | null) ?? null,
    fechaPago: row.fecha_pago as string,
    monto: Number(row.monto),
    concepto: (row.concepto as string) ?? "",
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: asOrigen(row.origen),
    fileName: fileName ?? null,
  };
}

export function mapPolizaPago(
  row: Record<string, unknown>,
  fileName?: string | null
): PolizaPago {
  return {
    id: row.id as string,
    polizaId: row.poliza_id as string,
    fecha: row.fecha as string,
    monto: Number(row.monto),
    periodoDesde: (row.periodo_desde as string | null) ?? null,
    periodoHasta: (row.periodo_hasta as string | null) ?? null,
    concepto: (row.concepto as string) ?? "",
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: asOrigen(row.origen),
    fileName: fileName ?? null,
  };
}

export function mapPoliza(
  row: Record<string, unknown>,
  pagos: PolizaPago[]
): Poliza {
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const ultimoPago = pagos[0]?.fecha ?? null;
  return {
    id: row.id as string,
    aseguradora: (row.aseguradora as string) ?? "INS",
    numeroPoliza: row.numero_poliza as string,
    tipo: row.tipo as TipoPoliza,
    vigenciaDesde: (row.vigencia_desde as string | null) ?? null,
    vigenciaHasta: (row.vigencia_hasta as string | null) ?? null,
    primaTotal: row.prima_total != null ? Number(row.prima_total) : null,
    estado: (row.estado as Poliza["estado"]) ?? "vigente",
    notas: (row.notas as string | null) ?? null,
    totalPagado,
    pagosCount: pagos.length,
    ultimoPago,
    pagos,
  };
}

export function mapAporteCcss(
  row: Record<string, unknown>,
  fileName?: string | null
): AporteCcss {
  return {
    id: row.id as string,
    periodo: String(row.periodo ?? "").trim(),
    tipo: row.tipo as TipoAporteCcss,
    numeroPatrono: (row.numero_patrono as string | null) ?? null,
    fechaPago: row.fecha_pago as string,
    monto: Number(row.monto),
    concepto: (row.concepto as string) ?? "",
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: asOrigen(row.origen),
    fileName: fileName ?? null,
  };
}

export function mapSalario(
  row: Record<string, unknown>,
  fileName?: string | null
): Salario {
  return {
    id: row.id as string,
    empleadoId: (row.empleado_id as string | null) ?? null,
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    periodoInicio: (row.periodo_inicio as string | null) ?? null,
    periodoFin: (row.periodo_fin as string | null) ?? null,
    tipo: row.tipo as TipoSalario,
    monto: Number(row.monto),
    fechaPago: row.fecha_pago as string,
    concepto: (row.concepto as string) ?? "",
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: asOrigen(row.origen),
    fileName: fileName ?? null,
  };
}

export function mapViatico(
  row: Record<string, unknown>,
  fileName?: string | null
): Viatico {
  return {
    id: row.id as string,
    empleadoId: (row.empleado_id as string | null) ?? null,
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    fecha: row.fecha as string,
    destino: (row.destino as string) ?? "",
    motivo: (row.motivo as string | null) ?? null,
    monto: Number(row.monto),
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: asOrigen(row.origen),
    fileName: fileName ?? null,
  };
}

export async function fileNameByComprobanteIds(
  admin: SupabaseClient,
  granjaId: string,
  ids: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre")
    .eq("granja_id", granjaId)
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id, row.archivo_nombre);
  }
  return map;
}

export function snapshotObligacion(row: Record<string, unknown>) {
  return { ...row };
}
