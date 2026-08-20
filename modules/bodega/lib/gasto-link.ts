import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { CODIGO_POR_LINEA, type BodegaCodigo } from "../types/bodega.types";

export async function resolveCategoriaId(
  admin: SupabaseClient,
  codigo: BodegaCodigo
): Promise<string> {
  const { data, error } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(`Categoría '${codigo}' no encontrada.`, 400);
  return data.id as string;
}

export async function crearGastoBodega(
  admin: SupabaseClient,
  granjaId: string,
  codigo: BodegaCodigo,
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
  return data.id as string;
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

export async function anularBodegaPorGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string
): Promise<void> {
  const { error } = await admin
    .from("bodega_compras")
    .update({ deleted_at: new Date().toISOString() })
    .eq("granja_id", granjaId)
    .eq("gasto_id", gastoId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

export async function actualizarBodegaPorGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string,
  patch: { fecha?: string; concepto?: string; monto?: number }
): Promise<void> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fecha != null) body.fecha = patch.fecha;
  if (patch.concepto != null) body.concepto = patch.concepto;
  if (patch.monto != null) body.monto = patch.monto;
  const { error } = await admin
    .from("bodega_compras")
    .update(body)
    .eq("granja_id", granjaId)
    .eq("gasto_id", gastoId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

export { CODIGO_POR_LINEA };
