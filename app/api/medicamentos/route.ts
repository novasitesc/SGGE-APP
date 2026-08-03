import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  createMedicamento,
  listMedicamentos,
  parseCreateMedicamento,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const rows = await listMedicamentos(auth.ctx.admin, auth.ctx.granjaId);
    return jsonOk(rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const parsed = parseCreateMedicamento(await req.json());
    if (!parsed.ok) return jsonError(parsed.error, 400);
    const created = await createMedicamento(
      admin,
      granjaId,
      parsed.data,
      usuario?.id
    );
    return jsonOk(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
