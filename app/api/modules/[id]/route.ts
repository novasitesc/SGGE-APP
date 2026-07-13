import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, isUuid } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  getEstadoIdByCodigo,
  liberarCodigoSoftDeleted,
  nextCodigoForTipo,
} from "@/lib/api/corrales-helpers";
import {
  registrarHistorial,
  snapshotCorral,
} from "@/lib/api/historial-sistema";
import { MODULE_TYPE_OPTIONS } from "@/lib/modulos/constants";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(
  MODULE_TYPE_OPTIONS.map((o) => o.value as string)
);

type PatchBody = Partial<{
  name: string;
  type: string;
  capacity: number;
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
      .from("corrales")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Corral no encontrado.", 404);

    const snapAnt = snapshotCorral(current);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) patch.nombre = body.name.trim();
    if (body.capacity != null) patch.capacidad_maxima = body.capacity;

    if (body.type != null) {
      const tipo = body.type.trim();
      if (!VALID_TYPES.has(tipo)) {
        return jsonError(`Tipo de módulo inválido: ${tipo}.`);
      }
      patch.tipo = tipo;
      if (tipo !== current.tipo) {
        patch.codigo = await nextCodigoForTipo(admin, granjaId, tipo, id);
      }
    }

    let { data, error } = await admin
      .from("corrales")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error?.code === "23505" && typeof patch.codigo === "string") {
      await liberarCodigoSoftDeleted(admin, granjaId, patch.codigo);
      const retry = await admin
        .from("corrales")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === "23505") {
        return jsonError(
          `Ya existe un módulo activo con el código '${String(patch.codigo ?? "")}'.`
        );
      }
      return jsonError(error.message, 400);
    }

    const snapNew = snapshotCorral(data);
    const codigoCambio =
      data.codigo !== current.codigo
        ? ` (código ${current.codigo} → ${data.codigo})`
        : "";
    await registrarHistorial(admin, {
      granjaId,
      modulo: "modulos",
      registroId: id,
      referencia: data.codigo,
      accion: "modificar",
      resumen: `Corral ${data.codigo} modificado: ${data.nombre}.${codigoCambio}`,
      datosAnteriores: snapAnt,
      datosNuevos: snapNew,
    });

    return jsonOk({
      id: data.codigo,
      uuid: data.id,
      name: data.nombre,
      type: data.tipo,
      capacity: data.capacidad_maxima,
      animalCount: data.ocupacion_actual,
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
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data: current, error: e0 } = await admin
      .from("corrales")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Corral no encontrado.", 404);

    if (Number(current.ocupacion_actual) > 0) {
      return jsonError("No se puede eliminar un corral con animales activos.", 409);
    }

    const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
    const { count: activeAnimals } = await admin
      .from("animales")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .eq("corral_id", id)
      .eq("estado_id", estadoActivo)
      .is("deleted_at", null);
    if ((activeAnimals ?? 0) > 0) {
      return jsonError(
        "No se puede eliminar un módulo con animales activos asignados.",
        409
      );
    }

    const { error } = await admin
      .from("corrales")
      .update({
        deleted_at: new Date().toISOString(),
        activo: false,
      })
      .eq("id", id);
    if (error) return jsonError(error.message, 400);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "modulos",
      registroId: id,
      referencia: current.codigo,
      accion: "eliminar",
      resumen: `Corral eliminado: ${current.codigo} — ${current.nombre}.`,
      datosAnteriores: snapshotCorral(current),
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

/** Resolver corral por UUID o código (M1, CQ, etc.) */
export async function resolveCorralId(
  admin: ReturnType<typeof createSupabaseAdmin>,
  granjaId: string,
  idOrCode: string
): Promise<string | null> {
  if (isUuid(idOrCode)) return idOrCode;
  const { data } = await admin
    .from("corrales")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("codigo", idOrCode.trim())
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id ?? null;
}
