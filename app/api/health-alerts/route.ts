import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  createAlerta,
  listAlertas,
  parseCreateAlert,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const includeResolved = url.searchParams.get("all") === "1";

    const alerts = await listAlertas(admin, granjaId, { includeResolved });
    return jsonOk(alerts);
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
    const parsed = parseCreateAlert(await req.json());
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const created = await createAlerta(
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
