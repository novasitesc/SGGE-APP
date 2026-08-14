import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createSalario,
  listSalarios,
  parseCreateSalario,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const rows = await listSalarios(auth.ctx.admin, auth.ctx.granjaId);
    return jsonOk(rows);
  } catch (e) {
    return jsonServerError("salarios", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreateSalario(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createSalario(auth.ctx.admin, auth.ctx.granjaId, parsed.data);
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("salarios", e);
  }
}
