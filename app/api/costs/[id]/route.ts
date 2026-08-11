import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { mapCostRow, type CostRowExtras } from "@/lib/api/mappers";
import {
  registrarHistorial,
  snapshotGasto,
} from "@/lib/api/historial-sistema";
import { resolveCategoriaCodigo } from "@/lib/costs/categories";

export const dynamic = "force-dynamic";

async function getCategoriaId(admin: SupabaseClient, category: string) {
  const catCodigo = resolveCategoriaCodigo(category);
  const { data, error } = await admin
    .from("categorias_gastos")
    .select("id, codigo, nombre")
    .eq("codigo", catCodigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { categoria: data, catCodigo };
}

async function origenExtrasForGasto(
  admin: SupabaseClient,
  granjaId: string,
  gastoId: string
): Promise<CostRowExtras> {
  const { data, error } = await admin
    .from("comprobantes")
    .select("id, emisor_nombre, archivo_nombre")
    .eq("granja_id", granjaId)
    .eq("gasto_id", gastoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { source: "manual" };
  return {
    source: "comprobante",
    issuer: data.emisor_nombre,
    comprobanteId: data.id,
    fileName: data.archivo_nombre,
  };
}

type PatchBody = Partial<{
  category: string;
  description: string;
  amount: number;
  date: string;
}>;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("gastos")
      .select("id, fecha, concepto, monto, categorias_gastos(codigo, nombre)")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Gasto no encontrado.", 404);

    const catRaw = (current as Record<string, unknown>).categorias_gastos;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const snapAnt = snapshotGasto({
      concepto: current.concepto,
      monto: Number(current.monto),
      fecha: current.fecha,
      categoria: (cat as { nombre?: string })?.nombre,
    });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.description != null) patch.concepto = body.description.trim();
    if (body.amount != null) patch.monto = body.amount;
    if (body.date != null) patch.fecha = body.date;
    if (body.category != null) {
      const { categoria } = await getCategoriaId(admin, body.category);
      if (!categoria) return jsonError(`Categoría '${body.category}' no encontrada.`);
      patch.categoria_id = categoria.id;
    }

    const { data, error } = await admin
      .from("gastos")
      .update(patch)
      .eq("id", id)
      .select("id, fecha, concepto, monto, categorias_gastos(codigo, nombre)")
      .single();
    if (error) return jsonError(error.message, 400);

    const extras = await origenExtrasForGasto(admin, granjaId, id);
    const mapped = mapCostRow(data as Record<string, unknown>, extras);
    const catNewRaw = (data as Record<string, unknown>).categorias_gastos;
    const catNew = Array.isArray(catNewRaw) ? catNewRaw[0] : catNewRaw;

    await registrarHistorial(admin, {
      granjaId,
      modulo: "costos",
      registroId: id,
      referencia: mapped.description.slice(0, 200),
      accion: "modificar",
      resumen: `Costo modificado: ${mapped.description} — ₡${mapped.amount}.`,
      datosAnteriores: snapAnt,
      datosNuevos: snapshotGasto({
        concepto: mapped.description,
        monto: mapped.amount,
        fecha: mapped.date,
        categoria: (catNew as { nombre?: string })?.nombre,
      }),
    });

    return jsonOk(mapped);
  } catch (e) {
    return jsonServerError("costs/[id]", e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const { data: current, error: e0 } = await admin
      .from("gastos")
      .select("id, fecha, concepto, monto, categorias_gastos(nombre)")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Gasto no encontrado.", 404);

    const catRaw = (current as Record<string, unknown>).categorias_gastos;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const snap = snapshotGasto({
      concepto: current.concepto,
      monto: Number(current.monto),
      fecha: current.fecha,
      categoria: (cat as { nombre?: string })?.nombre,
    });

    const { error } = await admin
      .from("gastos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return jsonError(error.message, 400);

    // Liberar enlace en comprobantes para no dejar facturas huérfanas
    const { error: eUnlink } = await admin
      .from("comprobantes")
      .update({ gasto_id: null })
      .eq("granja_id", granjaId)
      .eq("gasto_id", id);
    if (eUnlink) throw new Error(eUnlink.message);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "costos",
      registroId: id,
      referencia: current.concepto.slice(0, 200),
      accion: "eliminar",
      resumen: `Gasto eliminado: ${current.concepto} — ₡${current.monto} (${current.fecha}).`,
      datosAnteriores: snap,
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonServerError("costs/[id]", e);
  }
}
