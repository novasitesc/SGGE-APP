import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { ObligacionCodigo } from "../types/obligaciones.types";

const DOMAIN_TABLES = [
  "servicios_publicos",
  "poliza_pagos",
  "aportes_ccss",
  "salarios",
  "viaticos",
] as const;

export async function resolveCategoriaId(
  admin: SupabaseClient,
  codigo: ObligacionCodigo
): Promise<string> {
  const { data, error } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(`Categoría '${codigo}' no encontrada.`, 400);
  return data.id;
}

export async function crearGastoCategoria(
  admin: SupabaseClient,
  granjaId: string,
  codigo: ObligacionCodigo,
  input: { fecha: string; concepto: string; monto: number; referencia?: string | null }
): Promise<string> {
  const categoriaId = await resolveCategoriaId(admin, codigo);
  const { data, error } = await admin
    .from("gastos")
    .insert({
      granja_id: granjaId,
      categoria_id: categoriaId,
      fecha: input.fecha,
      concepto: input.concepto.slice(0, 255),
      monto: input.monto,
      referencia: input.referencia ?? null,
    })
    .select("id")
    .single();
  if (error) throw new ApiError(error.message, 400);
  return data.id;
}

export async function actualizarGastoVinculado(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string,
  patch: { fecha?: string; concepto?: string; monto?: number }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.fecha != null) body.fecha = patch.fecha;
  if (patch.concepto != null) body.concepto = patch.concepto.slice(0, 255);
  if (patch.monto != null) body.monto = patch.monto;
  if (Object.keys(body).length === 0) return;
  const { error } = await admin
    .from("gastos")
    .update(body)
    .eq("id", gastoId)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);
}

export async function anularGastoVinculado(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string | null
): Promise<void> {
  if (!gastoId) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("gastos")
    .update({ deleted_at: now })
    .eq("id", gastoId)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);
  if (error) throw new ApiError(error.message, 400);

  const { error: eUnlink } = await admin
    .from("comprobantes")
    .update({ gasto_id: null })
    .eq("granja_id", granjaId)
    .eq("gasto_id", gastoId);
  if (eUnlink) throw new Error(eUnlink.message);
}

export async function rollbackGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string
): Promise<void> {
  await admin
    .from("gastos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", gastoId)
    .eq("granja_id", granjaId);
}

export async function anularDominioPorGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const table of DOMAIN_TABLES) {
    const { error } = await admin
      .from(table)
      .update({ deleted_at: now })
      .eq("granja_id", granjaId)
      .eq("gasto_id", gastoId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export async function actualizarDominioPorGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string,
  patch: { fecha?: string; concepto?: string; monto?: number }
): Promise<void> {
  const now = new Date().toISOString();

  const spub: Record<string, unknown> = { updated_at: now };
  if (patch.fecha != null) spub.fecha_pago = patch.fecha;
  if (patch.concepto != null) spub.concepto = patch.concepto;
  if (patch.monto != null) spub.monto = patch.monto;
  await admin.from("servicios_publicos").update(spub).eq("granja_id", granjaId).eq("gasto_id", gastoId).is("deleted_at", null);

  const pago: Record<string, unknown> = { updated_at: now };
  if (patch.fecha != null) pago.fecha = patch.fecha;
  if (patch.concepto != null) pago.concepto = patch.concepto;
  if (patch.monto != null) pago.monto = patch.monto;
  await admin.from("poliza_pagos").update(pago).eq("granja_id", granjaId).eq("gasto_id", gastoId).is("deleted_at", null);

  const ccss: Record<string, unknown> = { updated_at: now };
  if (patch.fecha != null) ccss.fecha_pago = patch.fecha;
  if (patch.concepto != null) ccss.concepto = patch.concepto;
  if (patch.monto != null) ccss.monto = patch.monto;
  await admin.from("aportes_ccss").update(ccss).eq("granja_id", granjaId).eq("gasto_id", gastoId).is("deleted_at", null);

  const sal: Record<string, unknown> = { updated_at: now };
  if (patch.fecha != null) sal.fecha_pago = patch.fecha;
  if (patch.concepto != null) sal.concepto = patch.concepto;
  if (patch.monto != null) sal.monto = patch.monto;
  await admin.from("salarios").update(sal).eq("granja_id", granjaId).eq("gasto_id", gastoId).is("deleted_at", null);

  const viat: Record<string, unknown> = { updated_at: now };
  if (patch.fecha != null) viat.fecha = patch.fecha;
  if (patch.monto != null) viat.monto = patch.monto;
  await admin.from("viaticos").update(viat).eq("granja_id", granjaId).eq("gasto_id", gastoId).is("deleted_at", null);
}
