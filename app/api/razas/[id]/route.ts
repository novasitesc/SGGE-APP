
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { findRazaByNombre, type RazaRow } from "@/lib/api/razas-helpers";

export const dynamic = "force-dynamic";

type PatchBody = {
  nombre?: string;
  codigo?: string;
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
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("razas")
      .select("id, codigo, nombre, activa")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Raza no encontrada.", 404);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre != null) {
      const nombre = body.nombre.trim();
      if (!nombre) return jsonError("nombre no puede estar vacío.");
      if (nombre.length > 100) {
        return jsonError("nombre no puede superar 100 caracteres.");
      }
      const dup = await findRazaByNombre(admin, granjaId, nombre, id);
      if (dup) {
        return jsonError(`Ya existe una raza con el nombre '${dup.nombre}'.`);
      }
      patch.nombre = nombre;
    }

    if (body.codigo != null) {
      const codigo = body.codigo.trim().toUpperCase().slice(0, 20);
      if (!codigo) return jsonError("codigo no puede estar vacío.");
      patch.codigo = codigo;
    }

    if (body.activa != null) patch.activa = body.activa;

    const { data, error } = await admin
      .from("razas")
      .update(patch)
      .eq("id", id)
      .select("id, codigo, nombre, activa")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("Ya existe una raza con ese código.");
      }
      return jsonError(error.message, 400);
    }

    return jsonOk(data as RazaRow);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
