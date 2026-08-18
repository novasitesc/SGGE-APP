import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ObligacionCodigo,
  TipoAporteCcss,
  TipoPoliza,
  TipoSalario,
  TipoServicioPublico,
} from "../types/obligaciones.types";
import {
  extractNumeroPoliza,
  extractPeriodoCcss,
  inferTipoPoliza,
  inferTipoServicioPublico,
} from "./parse-text";

const TIPOS_SERVICIO: readonly string[] = [
  "electricidad",
  "agua",
  "telecomunicaciones",
  "internet",
  "otro",
];
const TIPOS_POLIZA: readonly string[] = [
  "riesgos_trabajo",
  "vehiculo",
  "ganadero",
  "incendio",
  "otro",
];
const TIPOS_APORTE: readonly string[] = [
  "cuota_obrero_patronal",
  "ivm",
  "sem",
  "otro",
];
const TIPOS_SALARIO: readonly string[] = [
  "ordinario",
  "extraordinario",
  "aguinaldo",
  "liquidacion",
  "otro",
];

function asTipo<T extends string>(raw: string | null | undefined, allowed: readonly string[], fallback: T): T {
  const v = raw?.trim();
  return v && allowed.includes(v) ? (v as T) : fallback;
}

function normalizePeriodoCcss(
  raw: string | null | undefined,
  texto: string,
  fecha: string
): string {
  const compact = (raw ?? "").replace("-", "").trim();
  if (/^\d{6}$/.test(compact)) return compact;
  return extractPeriodoCcss(texto, fecha);
}

export type SyncGastoInput = {
  granjaId: string;
  gastoId: string;
  fecha: string;
  monto: number;
  concepto: string;
  emisorNombre?: string | null;
  comprobanteId?: string | null;
  texto?: string;
  tipoServicio?: string | null;
  numeroCuenta?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  numeroPoliza?: string | null;
  tipoPoliza?: string | null;
  polizaId?: string | null;
  periodoCcss?: string | null;
  tipoAporte?: string | null;
  empleadoId?: string | null;
  empleadoNombre?: string | null;
  tipoSalario?: string | null;
  destino?: string | null;
  motivo?: string | null;
};

async function alreadyLinked(
  admin: SupabaseClient,
  table: string,
  gastoId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("gasto_id", gastoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function sincronizarServicioPublicoDesdeGasto(
  admin: SupabaseClient,
  input: SyncGastoInput
): Promise<void> {
  if (await alreadyLinked(admin, "servicios_publicos", input.gastoId)) return;
  const texto = input.texto ?? input.concepto;
  const tipo = asTipo<TipoServicioPublico>(
    input.tipoServicio,
    TIPOS_SERVICIO,
    inferTipoServicioPublico(texto, input.emisorNombre ?? null)
  );
  const proveedor = (input.emisorNombre ?? "Servicio público").slice(0, 120);
  const { error } = await admin.from("servicios_publicos").insert({
    granja_id: input.granjaId,
    tipo,
    proveedor,
    numero_cuenta: input.numeroCuenta?.trim() || null,
    periodo_inicio: input.periodoInicio || null,
    periodo_fin: input.periodoFin || null,
    fecha_pago: input.fecha,
    monto: input.monto,
    concepto: input.concepto.slice(0, 255),
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}

export async function sincronizarPolizaDesdeGasto(
  admin: SupabaseClient,
  input: SyncGastoInput
): Promise<void> {
  if (await alreadyLinked(admin, "poliza_pagos", input.gastoId)) return;

  const texto = `${input.texto ?? ""} ${input.concepto}`;
  const numero =
    input.numeroPoliza?.trim() || extractNumeroPoliza(texto) || "SIN-NUMERO";
  const tipo = asTipo<TipoPoliza>(
    input.tipoPoliza,
    TIPOS_POLIZA,
    inferTipoPoliza(texto)
  );
  const aseguradora =
    (input.emisorNombre ?? "").toLowerCase().includes("ins") ||
    texto.toLowerCase().includes("instituto nacional de seguros")
      ? "INS"
      : (input.emisorNombre ?? "Aseguradora").slice(0, 80);

  let polizaId = input.polizaId?.trim() || undefined;
  if (!polizaId) {
    const { data: existing, error: eFind } = await admin
      .from("polizas")
      .select("id")
      .eq("granja_id", input.granjaId)
      .eq("numero_poliza", numero)
      .is("deleted_at", null)
      .maybeSingle();
    if (eFind) throw new Error(eFind.message);
    polizaId = existing?.id as string | undefined;
  }
  if (!polizaId) {
    const { data: created, error: eIns } = await admin
      .from("polizas")
      .insert({
        granja_id: input.granjaId,
        aseguradora,
        numero_poliza: numero,
        tipo,
        estado: "vigente",
        notas: `Creada desde comprobante · gasto:${input.gastoId}`,
      })
      .select("id")
      .single();
    if (eIns) throw new Error(eIns.message);
    polizaId = created.id;
  }

  const { error } = await admin.from("poliza_pagos").insert({
    granja_id: input.granjaId,
    poliza_id: polizaId,
    fecha: input.fecha,
    monto: input.monto,
    concepto: input.concepto.slice(0, 255),
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}

export async function sincronizarAporteCcssDesdeGasto(
  admin: SupabaseClient,
  input: SyncGastoInput
): Promise<void> {
  if (await alreadyLinked(admin, "aportes_ccss", input.gastoId)) return;
  const texto = `${input.texto ?? ""} ${input.concepto}`;
  const periodo = normalizePeriodoCcss(input.periodoCcss, texto, input.fecha);
  const tipo = asTipo<TipoAporteCcss>(
    input.tipoAporte,
    TIPOS_APORTE,
    "cuota_obrero_patronal"
  );
  const { error } = await admin.from("aportes_ccss").insert({
    granja_id: input.granjaId,
    periodo,
    tipo,
    fecha_pago: input.fecha,
    monto: input.monto,
    concepto: input.concepto.slice(0, 255),
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}

export async function sincronizarSalarioDesdeGasto(
  admin: SupabaseClient,
  input: SyncGastoInput
): Promise<void> {
  if (await alreadyLinked(admin, "salarios", input.gastoId)) return;
  const empleadoNombre =
    input.empleadoNombre?.trim() || "Planilla";
  const tipo = asTipo<TipoSalario>(input.tipoSalario, TIPOS_SALARIO, "ordinario");
  const { error } = await admin.from("salarios").insert({
    granja_id: input.granjaId,
    empleado_id: input.empleadoId?.trim() || null,
    empleado_nombre: empleadoNombre,
    tipo,
    monto: input.monto,
    fecha_pago: input.fecha,
    concepto: input.concepto.slice(0, 255),
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}

export async function sincronizarViaticoDesdeGasto(
  admin: SupabaseClient,
  input: SyncGastoInput
): Promise<void> {
  if (await alreadyLinked(admin, "viaticos", input.gastoId)) return;
  const { error } = await admin.from("viaticos").insert({
    granja_id: input.granjaId,
    empleado_id: input.empleadoId?.trim() || null,
    empleado_nombre:
      input.empleadoNombre?.trim() || input.emisorNombre || "Personal",
    fecha: input.fecha,
    destino: input.destino?.trim() || "—",
    motivo: input.motivo?.trim() || input.concepto.slice(0, 255),
    monto: input.monto,
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}

export async function sincronizarObligacionDesdeGasto(
  admin: SupabaseClient,
  codigo: string,
  input: SyncGastoInput
): Promise<void> {
  const code = codigo.toUpperCase() as ObligacionCodigo;
  if (code === "SPUB") return sincronizarServicioPublicoDesdeGasto(admin, input);
  if (code === "POL") return sincronizarPolizaDesdeGasto(admin, input);
  if (code === "CCSS") return sincronizarAporteCcssDesdeGasto(admin, input);
  if (code === "SAL") return sincronizarSalarioDesdeGasto(admin, input);
  if (code === "VIAT") return sincronizarViaticoDesdeGasto(admin, input);
}
