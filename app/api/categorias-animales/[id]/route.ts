import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import { updateFlexible } from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

function mapRow(raw: Record<string, unknown>) {
  const codigo = String(raw.codigo ?? "");
  return {
    id: String(raw.id),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    peso_min_kg:
      raw.peso_min_kg == null || raw.peso_min_kg === ""
        ? null
        : Number(raw.peso_min_kg),
    peso_max_kg:
      raw.peso_max_kg == null || raw.peso_max_kg === ""
        ? null
        : Number(raw.peso_max_kg),
    activa: raw.activa == null ? true : Boolean(raw.activa),
  };
}

type PatchBody = {
  nombre?: string;
  codigo?: string;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  activa?: boolean;
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
      "Solo un administrador puede modificar el catálogo de categorías."
    );
    if (denied) return denied;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("categorias_animales")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Categoría no encontrada.", 404);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre != null) {
      const nombre = body.nombre.trim();
      if (!nombre) return jsonError("nombre no puede estar vacío.");
      patch.nombre = nombre;
    }
    if (body.codigo != null) {
      const codigo = body.codigo.trim().toUpperCase().slice(0, 20);
      if (!codigo) return jsonError("codigo no puede estar vacío.");
      const { data: dup } = await admin
        .from("categorias_animales")
        .select("id")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .ilike("codigo", codigo)
        .neq("id", id)
        .maybeSingle();
      if (dup) return jsonError(`Ya existe una categoría con el código '${codigo}'.`);
      patch.codigo = codigo;
    }
    if (body.peso_min_kg !== undefined) patch.peso_min_kg = body.peso_min_kg;
    if (body.peso_max_kg !== undefined) patch.peso_max_kg = body.peso_max_kg;
    if (body.activa != null) patch.activa = body.activa;

    const { data, error } = await updateFlexible(
      admin,
      "categorias_animales",
      id,
      patch
    );
    if (error) {
      if (/duplicate|unique|23505/i.test(error)) {
        return jsonError("Ya existe una categoría con ese código.");
      }
      return jsonError(error, 400);
    }

    return jsonOk(mapRow(data));
  } catch (e) {
    return jsonServerError("categorias-animales/[id]", e);
  }
}
