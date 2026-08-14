import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  parseCreateViatico,
  softDeleteViatico,
  updateViatico,
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
    const parsed = parseCreateViatico(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await updateViatico(auth.ctx.admin, auth.ctx.granjaId, id, parsed.data);
    return jsonOk(row);
  } catch (e) {
    return jsonServerError("viaticos/[id]", e);
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
    await softDeleteViatico(auth.ctx.admin, auth.ctx.granjaId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonServerError("viaticos/[id]", e);
  }
}
