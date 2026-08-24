import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createBodegaCompra,
  listBodegaCompras,
  parseCreateBodegaCompra,
} from "@/modules/bodega";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const rows = await listBodegaCompras(auth.ctx.admin, auth.ctx.granjaId);
    return jsonOk(rows);
  } catch (e) {
    return jsonServerError("bodega", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreateBodegaCompra(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createBodegaCompra(auth.ctx.admin, auth.ctx.granjaId, parsed.data);
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("bodega", e);
  }
}
