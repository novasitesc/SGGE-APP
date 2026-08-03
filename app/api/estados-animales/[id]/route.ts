import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import { updateFlexible } from "@/lib/api/catalog-flexible";
import {
  ESTADOS_SISTEMA,
  mapEstadoRow,
} from "@/lib/api/estados-helpers";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type PatchBody = {
  nombre?: string;
  codigo?: string;
  activo?: boolean;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(
      auth.ctx.roles,
      "Solo un administrador puede modificar el catálogo de estados."
    );
    if (denied) return denied;
    const { admin } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("estados_animales")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Estado no encontrado.", 404);

    const codigoActual = String(
      (current as { codigo?: string }).codigo ?? ""
    ).toLowerCase();

    const patch: Record<string, unknown> = {};

    if (body.nombre != null) {
      const nombre = body.nombre.trim();
      if (!nombre) return jsonError("nombre no puede estar vacío.");
      patch.nombre = nombre;
    }

    if (body.codigo != null) {
      if (ESTADOS_SISTEMA.has(codigoActual)) {
        return jsonError(
          `El código '${codigoActual}' es usado por el sistema y no se puede cambiar.`
        );
      }
      const codigo = body.codigo.trim().toLowerCase().slice(0, 30);
      if (!codigo) return jsonError("codigo no puede estar vacío.");
      const { data: dup } = await admin
        .from("estados_animales")
        .select("id")
        .ilike("codigo", codigo)
        .neq("id", id)
        .maybeSingle();
      if (dup) return jsonError(`Ya existe un estado con el código '${codigo}'.`);
      patch.codigo = codigo;
    }

    if (body.activo != null) {
      if (ESTADOS_SISTEMA.has(codigoActual) && body.activo === false) {
        return jsonError(
          `El estado '${codigoActual}' es requerido por el sistema y no se puede desactivar.`
        );
      }
      patch.activo = body.activo;
      patch.activa = body.activo;
    }

    if (Object.keys(patch).length === 0) {
      return jsonOk(mapEstadoRow(current as Record<string, unknown>));
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await updateFlexible(
      admin,
      "estados_animales",
      id,
      patch
    );
    if (error) return jsonError(error, 400);

    return jsonOk(mapEstadoRow(data));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
