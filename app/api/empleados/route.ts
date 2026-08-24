import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  createEmpleado,
  listEmpleados,
  parseCreateEmpleado,
} from "@/modules/obligaciones";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const includeInactive = new URL(req.url).searchParams.get("all") === "1";
    const rows = await listEmpleados(auth.ctx.admin, auth.ctx.granjaId, {
      includeInactive,
    });
    return jsonOk(rows);
  } catch (e) {
    return jsonServerError("empleados", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const parsed = parseCreateEmpleado(await req.json());
    if (!parsed.ok) return jsonError(parsed.error);
    const row = await createEmpleado(
      auth.ctx.admin,
      auth.ctx.granjaId,
      parsed.data,
      auth.ctx.usuario.id
    );
    return jsonOk(row, { status: 201 });
  } catch (e) {
    return jsonServerError("empleados", e);
  }
}
