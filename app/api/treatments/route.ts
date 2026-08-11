import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  computeSaludKpis,
  createTratamiento,
  createTratamientosBulk,
  listTratamientos,
  parseCreateTreatment,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const treatments = await listTratamientos(admin, granjaId, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      animalId: url.searchParams.get("animalId") ?? undefined,
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });

    if (url.searchParams.get("includeKpis") === "1") {
      const kpis = computeSaludKpis(treatments);
      return jsonOk({ treatments, kpis });
    }

    return jsonOk(treatments);
  } catch (e) {
    return jsonServerError("treatments", e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const body = await req.json();

    if (body?.bulk === true && Array.isArray(body.animalIds)) {
      const parsed = parseCreateTreatment(body);
      if (!parsed.ok) return jsonError(parsed.error, 400);
      const created = await createTratamientosBulk(
        admin,
        granjaId,
        parsed.data,
        body.animalIds as string[],
        usuario?.id
      );
      return jsonOk(created, { status: 201 });
    }

    const parsed = parseCreateTreatment(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const created = await createTratamiento(
      admin,
      granjaId,
      parsed.data,
      usuario?.id
    );
    return jsonOk(created, { status: 201 });
  } catch (e) {
    return jsonServerError("treatments", e);
  }
}
