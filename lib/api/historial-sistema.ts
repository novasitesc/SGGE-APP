import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystemUserId } from "@/lib/api/granja";

export type HistorialModulo =
  | "animales"
  | "modulos"
  | "ventas"
  | "costos"
  | "alimentacion"
  | "salud"
  | "contabilidad";

export type HistorialAccion =
  | "crear"
  | "modificar"
  | "eliminar"
  | "vender"
  | "pesaje"
  | "acta";

export const MODULO_LABELS: Record<HistorialModulo, string> = {
  animales: "Animales",
  modulos: "Módulos / Corrales",
  ventas: "Ventas",
  costos: "Costos",
  alimentacion: "Alimentación",
  salud: "Salud",
  contabilidad: "Contabilidad",
};

export type RegistrarHistorialInput = {
  granjaId: string;
  modulo: HistorialModulo;
  registroId?: string | null;
  referencia: string;
  accion: HistorialAccion;
  resumen: string;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
  usuarioId?: string | null;
};

export type HistorialRow = {
  id: string;
  granja_id: string;
  modulo: HistorialModulo;
  registro_id: string | null;
  referencia: string;
  accion: HistorialAccion;
  resumen: string;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  usuario_id: string | null;
  created_at: string;
  usuarios?: { nombre: string; apellido: string | null; email: string } | null;
};

export async function registrarHistorial(
  admin: SupabaseClient,
  input: RegistrarHistorialInput
): Promise<void> {
  const { error } = await admin.from("historial_sistema").insert({
    granja_id: input.granjaId,
    modulo: input.modulo,
    registro_id: input.registroId ?? null,
    referencia: input.referencia.slice(0, 200),
    accion: input.accion,
    resumen: input.resumen,
    datos_anteriores: input.datosAnteriores ?? null,
    datos_nuevos: input.datosNuevos ?? null,
    usuario_id: input.usuarioId ?? getSystemUserId(),
  });

  if (error) {
    const fallback = error.message.includes("historial_sistema")
      ? "historial_sistema"
      : "historial";
    console.error(`[${fallback}] No se pudo registrar evento:`, error.message);
  }
}

export function mapHistorialToApi(row: HistorialRow) {
  const user = row.usuarios;
  const usuarioNombre = user
    ? [user.nombre, user.apellido].filter(Boolean).join(" ") || user.email
    : "Sistema";

  return {
    id: row.id,
    module: row.modulo,
    moduleLabel: MODULO_LABELS[row.modulo] ?? row.modulo,
    recordId: row.registro_id,
    reference: row.referencia,
    action: row.accion,
    summary: row.resumen,
    previousData: row.datos_anteriores,
    newData: row.datos_nuevos,
    userId: row.usuario_id,
    userName: usuarioNombre,
    createdAt: row.created_at,
    /** Compatibilidad con vista de animales */
    animalId: row.modulo === "animales" ? row.registro_id : null,
    tagId: row.modulo === "animales" ? row.referencia : row.referencia,
  };
}

export function snapshotGasto(row: {
  concepto: string;
  monto: number;
  fecha: string;
  categoria?: string;
}) {
  return {
    concepto: row.concepto,
    monto: Number(row.monto),
    fecha: row.fecha,
    categoria: row.categoria ?? "—",
  };
}

export function snapshotCorral(row: {
  codigo: string;
  nombre: string;
  capacidad_maxima?: number;
  tipo?: string | null;
  ocupacion_actual?: number;
}) {
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    capacidad: Number(row.capacidad_maxima ?? 0),
    tipo: row.tipo ?? "engorda",
    ocupacion: Number(row.ocupacion_actual ?? 0),
  };
}

export function snapshotAlimento(row: {
  codigo?: string;
  nombre: string;
  tipo?: string;
  costo_unitario: number;
  unidad_medida?: string;
}) {
  return {
    codigo: row.codigo ?? "—",
    nombre: row.nombre,
    tipo: row.tipo ?? "—",
    costoUnitario: Number(row.costo_unitario),
    unidad: row.unidad_medida ?? "kg",
  };
}

export function snapshotVenta(params: {
  arete: string;
  comprador: string;
  pesoKg: number;
  precioKg: number;
  total: number;
  fecha: string;
  folio?: string;
}) {
  return {
    arete: params.arete,
    comprador: params.comprador,
    pesoKg: params.pesoKg,
    precioKg: params.precioKg,
    total: params.total,
    fecha: params.fecha,
    folio: params.folio,
  };
}
