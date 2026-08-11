import { requireApiContext } from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";
import { listMedicamentos, softDeleteMedicamento } from "@/modules/salud";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const { id } = await ctx.params;
    const meds = await listMedicamentos(admin, granjaId);
    const found = meds.find((m) => m.id === id);
    await softDeleteMedicamento(
      admin,
      granjaId,
      id,
      found?.name ?? id,
      usuario?.id
    );
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonServerError("medicamentos/[id]", e);
  }
}
