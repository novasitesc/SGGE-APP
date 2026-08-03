import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  getAlertaById,
  parseUpdateAlert,
  softDeleteAlerta,
  updateAlerta,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { id } = await ctx.params;
    const row = await getAlertaById(auth.ctx.admin, id);
    if (!row) return jsonError("Alerta no encontrada.", 404);
    return jsonOk(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const { id } = await ctx.params;
    const previous = await getAlertaById(admin, id);
    if (!previous) return jsonError("Alerta no encontrada.", 404);

    const parsed = parseUpdateAlert(await req.json());
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const updated = await updateAlerta(
      admin,
      granjaId,
      id,
      parsed.data,
      usuario?.id,
      previous
    );
    return jsonOk(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const { id } = await ctx.params;
    const previous = await getAlertaById(admin, id);
    await softDeleteAlerta(admin, granjaId, id, previous, usuario?.id);
    return jsonOk({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
