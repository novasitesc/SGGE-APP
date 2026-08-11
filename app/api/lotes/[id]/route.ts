import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import { updateFlexible } from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

const ESTADOS_LOTE = new Set(["abierto", "cerrado"]);

function mapRow(raw: Record<string, unknown>) {
  const codigo = String(raw.codigo ?? "");
  return {
    id: String(raw.id),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    estado: String(raw.estado ?? "abierto"),
    fecha_apertura: raw.fecha_apertura
      ? String(raw.fecha_apertura).slice(0, 10)
      : null,
    fecha_cierre: raw.fecha_cierre
      ? String(raw.fecha_cierre).slice(0, 10)
      : null,
  };
}

type PatchBody = {
  codigo?: string;
  nombre?: string;
  estado?: string;
  fecha_apertura?: string;
  fecha_cierre?: string | null;
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
      "Solo un administrador puede modificar el catálogo de lotes."
    );
    if (denied) return denied;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("lotes")
      .select("*")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Lote no encontrado.", 404);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre != null) {
      const nombre = body.nombre.trim();
      if (!nombre) return jsonError("nombre no puede estar vacío.");
      patch.nombre = nombre;
    }
    if (body.codigo != null) {
      const codigo = body.codigo.trim().toUpperCase().slice(0, 30);
      if (!codigo) return jsonError("codigo no puede estar vacío.");
      const { data: dup } = await admin
        .from("lotes")
        .select("id")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .ilike("codigo", codigo)
        .neq("id", id)
        .maybeSingle();
      if (dup) return jsonError(`Ya existe un lote con el código '${codigo}'.`);
      patch.codigo = codigo;
    }
    if (body.estado != null) {
      const estado = body.estado.trim().toLowerCase();
      if (!ESTADOS_LOTE.has(estado)) {
        return jsonError("estado debe ser 'abierto' o 'cerrado'.");
      }
      patch.estado = estado;
      if (estado === "cerrado" && body.fecha_cierre === undefined) {
        patch.fecha_cierre = new Date().toISOString().slice(0, 10);
      }
      if (estado === "abierto") {
        patch.fecha_cierre = null;
      }
    }
    if (body.fecha_apertura != null) {
      patch.fecha_apertura = body.fecha_apertura.slice(0, 10);
    }
    if (body.fecha_cierre !== undefined) {
      patch.fecha_cierre = body.fecha_cierre
        ? body.fecha_cierre.slice(0, 10)
        : null;
    }

    const { data, error } = await updateFlexible(admin, "lotes", id, patch);
    if (error) return jsonError(error, 400);

    return jsonOk(mapRow(data));
  } catch (e) {
    return jsonServerError("lotes/[id]", e);
  }
}
