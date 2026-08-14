import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createPoliza,
  listPolizas,
  parseCreatePoliza,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const rows = await listPolizas(auth.ctx.admin, auth.ctx.granjaId);
    return jsonOk(rows);
  } catch (e) {
    return jsonServerError("polizas", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreatePoliza(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createPoliza(auth.ctx.admin, auth.ctx.granjaId, parsed.data);
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("polizas", e);
  }
}
