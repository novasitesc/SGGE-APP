import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createPolizaPago,
  parseCreatePolizaPago,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreatePolizaPago(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createPolizaPago(
      auth.ctx.admin,
      auth.ctx.granjaId,
      id,
      parsed.data
    );
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("polizas/[id]/pagos", e);
  }
}
