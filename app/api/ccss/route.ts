import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createAporteCcss,
  listAportesCcss,
  parseCreateAporteCcss,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const rows = await listAportesCcss(auth.ctx.admin, auth.ctx.granjaId);
    return jsonOk(rows);
  } catch (e) {
    return jsonServerError("ccss", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreateAporteCcss(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createAporteCcss(auth.ctx.admin, auth.ctx.granjaId, parsed.data);
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("ccss", e);
  }
}
