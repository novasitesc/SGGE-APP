import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  parseCreateAporteCcss,
  softDeleteAporteCcss,
  updateAporteCcss,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreateAporteCcss(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await updateAporteCcss(auth.ctx.admin, auth.ctx.granjaId, id, parsed.data);
    return jsonOk(row);
  } catch (e) {
    return jsonServerError("ccss/[id]", e);
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
    await softDeleteAporteCcss(auth.ctx.admin, auth.ctx.granjaId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonServerError("ccss/[id]", e);
  }
}
