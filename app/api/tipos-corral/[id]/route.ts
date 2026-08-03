import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import { updateFlexible } from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapTipoCorralRow } from "@/lib/api/tipos-corral-helpers";

export const dynamic = "force-dynamic";

type PatchBody = {
  nombre?: string;
  codigo?: string;
  prefijo?: string;
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
      "Solo un administrador puede modificar el catálogo de tipos de corral."
    );
    if (denied) return denied;
    const { admin } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    if (id.startsWith("const:")) {
      return jsonError(
        "Aplique la migración de tipos_corral para editar el catálogo en base de datos.",
        503
      );
    }

    const { data: current, error: e0 } = await admin
      .from("tipos_corral")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) {
      if (/does not exist|schema cache|Could not find the table/i.test(e0.message)) {
        return jsonError(
          "Tabla tipos_corral no existe. Aplique la migración 20260803120000_tipos_corral.sql.",
          503
        );
      }
      throw new Error(e0.message);
    }
    if (!current) return jsonError("Tipo de corral no encontrado.", 404);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre != null) {
      const nombre = body.nombre.trim();
      if (!nombre) return jsonError("nombre no puede estar vacío.");
      patch.nombre = nombre;
    }
    if (body.codigo != null) {
      const codigo = body.codigo.trim().toLowerCase().slice(0, 40);
      if (!codigo) return jsonError("codigo no puede estar vacío.");
      const { data: dup } = await admin
        .from("tipos_corral")
        .select("id")
        .is("deleted_at", null)
        .ilike("codigo", codigo)
        .neq("id", id)
        .maybeSingle();
      if (dup) return jsonError(`Ya existe un tipo con el código '${codigo}'.`);
      patch.codigo = codigo;
    }
    if (body.prefijo != null) {
      const prefijo = body.prefijo.trim().toUpperCase().slice(0, 10);
      if (!prefijo) return jsonError("prefijo no puede estar vacío.");
      patch.prefijo = prefijo;
    }
    if (body.activo != null) patch.activo = body.activo;

    const { data, error } = await updateFlexible(
      admin,
      "tipos_corral",
      id,
      patch
    );
    if (error) return jsonError(error, 400);

    return jsonOk(mapTipoCorralRow(data));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
