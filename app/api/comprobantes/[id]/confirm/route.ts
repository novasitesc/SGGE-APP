
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { confirmComprobante } from "@/lib/api/comprobantes";
import type { Clasificacion } from "@/lib/api/pdf/classify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConfirmBody = {
  classification?: Clasificacion;
  issuer?: string | null;
  issuerId?: string | null;
  issueDate?: string | null;
  amount?: number | null;
  categoryCode?: string | null;
  description?: string | null;
  cantidadAlim?: number | null;
  totalWeightKg?: number | null;
  buyer?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as ConfirmBody;

    if (
      body.classification !== "gasto" &&
      body.classification !== "compra_ganado" &&
      body.classification !== "venta"
    ) {
      return jsonError("classification debe ser 'gasto', 'compra_ganado' o 'venta'.");
    }

    const result = await confirmComprobante(admin, granjaId, id, {
      classification: body.classification,
      issuer: body.issuer,
      issuerId: body.issuerId,
      issueDate: body.issueDate,
      amount: body.amount,
      categoryCode: body.categoryCode,
      description: body.description,
      cantidadAlim: body.cantidadAlim,
      totalWeightKg: body.totalWeightKg,
      buyer: body.buyer,
    });

    if (!result.ok) return jsonError(result.message, result.status);
    return jsonOk(result.comprobante, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
