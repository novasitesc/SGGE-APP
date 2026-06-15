import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, isUuid } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  registrarHistorial,
  snapshotAlimento,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

type PatchBody = Partial<{
  name: string;
  type: string;
  unit: string;
  pricePerUnit: number;
}>;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("alimentos")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Alimento no encontrado.", 404);

    const snapAnt = snapshotAlimento(current);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) patch.nombre = body.name.trim();
    if (body.type != null) patch.tipo = body.type;
    if (body.unit != null) patch.unidad_medida = body.unit;
    if (body.pricePerUnit != null) patch.costo_unitario = body.pricePerUnit;

    const { data, error } = await admin
      .from("alimentos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 400);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "alimentacion",
      registroId: id,
      referencia: data.nombre,
      accion: "modificar",
      resumen: `Alimento modificado: ${data.nombre}.`,
      datosAnteriores: snapAnt,
      datosNuevos: snapshotAlimento(data),
    });

    return jsonOk({
      id: data.id,
      name: data.nombre,
      pricePerUnit: Number(data.costo_unitario),
    });
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
    if (!isUuid(id)) return jsonError("id inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data: current, error: e0 } = await admin
      .from("alimentos")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Alimento no encontrado.", 404);

    const { error } = await admin
      .from("alimentos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return jsonError(error.message, 400);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "alimentacion",
      registroId: id,
      referencia: current.nombre,
      accion: "eliminar",
      resumen: `Alimento eliminado: ${current.nombre}.`,
      datosAnteriores: snapshotAlimento(current),
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
