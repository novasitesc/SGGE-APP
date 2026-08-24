import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import {
  anularGastoVinculado,
  actualizarGastoVinculado,
  crearGastoCategoria,
  rollbackGasto,
} from "../lib/gasto-link";
import { TIPO_APORTE_CCSS_LABEL } from "../types/obligaciones.types";
import type { AporteCcss, CreateAporteCcssInput } from "../types/obligaciones.types";
import { getAporteCcss } from "../queries/ccss";
import { formatPeriodoLabel } from "../lib/parse-text";

function conceptoCcss(input: CreateAporteCcssInput): string {
  if (input.concepto?.trim()) return input.concepto.trim();
  return `CCSS ${TIPO_APORTE_CCSS_LABEL[input.tipo]} — ${formatPeriodoLabel(input.periodo)}`;
}

export async function createAporteCcss(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateAporteCcssInput
): Promise<AporteCcss> {
  const concepto = conceptoCcss(input);
  const gastoId = await crearGastoCategoria(admin, granjaId, "CCSS", {
    fecha: input.fechaPago,
    concepto,
    monto: input.monto,
  });
  const { data, error } = await admin
    .from("aportes_ccss")
    .insert({
      granja_id: granjaId,
      periodo: input.periodo,
      tipo: input.tipo,
      numero_patrono: input.numeroPatrono ?? null,
      fecha_pago: input.fechaPago,
      monto: input.monto,
      concepto,
      gasto_id: gastoId,
      origen: "manual",
    })
    .select("id")
    .single();
  if (error) {
    await rollbackGasto(admin, granjaId, gastoId);
    throw new ApiError(error.message, 400);
  }
  const row = await getAporteCcss(admin, granjaId, data.id);
  if (!row) throw new ApiError("No se pudo leer el aporte creado.", 500);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "ccss",
    registroId: row.id,
    referencia: concepto.slice(0, 200),
    accion: "crear",
    resumen: `Aporte CCSS ${formatPeriodoLabel(input.periodo)}: ₡${input.monto}.`,
    datosNuevos: { periodo: input.periodo, monto: input.monto },
  });
  return row;
}

export async function updateAporteCcss(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: Partial<CreateAporteCcssInput>
): Promise<AporteCcss> {
  const current = await getAporteCcss(admin, granjaId, id);
  if (!current) throw new ApiError("Aporte CCSS no encontrado.", 404);
  const merged: CreateAporteCcssInput = {
    periodo: input.periodo ?? current.periodo,
    tipo: input.tipo ?? current.tipo,
    numeroPatrono: input.numeroPatrono !== undefined ? input.numeroPatrono : current.numeroPatrono,
    fechaPago: input.fechaPago ?? current.fechaPago,
    monto: input.monto ?? current.monto,
    concepto: input.concepto !== undefined ? input.concepto : current.concepto,
  };
  const concepto = conceptoCcss(merged);
  const { error } = await admin
    .from("aportes_ccss")
    .update({
      periodo: merged.periodo,
      tipo: merged.tipo,
      numero_patrono: merged.numeroPatrono,
      fecha_pago: merged.fechaPago,
      monto: merged.monto,
      concepto,
    })
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);
  if (current.gastoId) {
    await actualizarGastoVinculado(admin, granjaId, current.gastoId, {
      fecha: merged.fechaPago,
      concepto,
      monto: merged.monto,
    });
  }
  const row = await getAporteCcss(admin, granjaId, id);
  if (!row) throw new ApiError("Aporte CCSS no encontrado.", 404);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "ccss",
    registroId: id,
    referencia: concepto.slice(0, 200),
    accion: "modificar",
    resumen: `Aporte CCSS actualizado: ${concepto} — ₡${merged.monto}.`,
  });
  return row;
}

export async function softDeleteAporteCcss(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<void> {
  const current = await getAporteCcss(admin, granjaId, id);
  if (!current) throw new ApiError("Aporte CCSS no encontrado.", 404);
  const { error } = await admin
    .from("aportes_ccss")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("granja_id", granjaId);
  if (error) throw new ApiError(error.message, 400);
  await anularGastoVinculado(admin, granjaId, current.gastoId);
  await registrarHistorial(admin, {
    granjaId,
    modulo: "ccss",
    registroId: id,
    referencia: current.concepto.slice(0, 200),
    accion: "eliminar",
    resumen: `Aporte CCSS eliminado: ${current.concepto} — ₡${current.monto}.`,
  });
}
