import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapCostRow } from "@/lib/api/mappers";
import {
  registrarHistorial,
  snapshotGasto,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

const CATEGORIA_MAP: Record<string, string> = {
  alimentación: "ALIM",
  alimentacion: "ALIM",
  transporte: "TRANS",
  mano_de_obra: "MO",
  vacunas: "VET",
  medicamentos: "VET",
  servicios: "MANT",
  otros: "OTRO",
};

async function getCategoriaId(admin: ReturnType<typeof createSupabaseAdmin>, category: string) {
  const catCodigo = CATEGORIA_MAP[category.toLowerCase()] ?? category.toUpperCase();
  const { data, error } = await admin
    .from("categorias_gastos")
    .select("id, codigo, nombre")
    .eq("codigo", catCodigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { categoria: data, catCodigo };
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
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
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

    const mapped = mapCostRow(data as Record<string, unknown>);
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
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

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
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
