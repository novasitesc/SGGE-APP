import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type PatchBody = {
  alimentacionId?: string;
  alimentoId?: string;
  cantidad?: number;
};

/**
 * Actualiza kg/und reales de una compra ALIM ya sincronizada.
 * Recalcula costo_unitario = subtotal / cantidad y actualiza catálogo si es razonable.
 */
export async function PATCH(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    const alimentacionId = body.alimentacionId?.trim();
    const alimentoId = body.alimentoId?.trim();
    const cantidad = Number(body.cantidad);

    if (!alimentacionId || !alimentoId) {
      return jsonError("alimentacionId y alimentoId son obligatorios.");
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return jsonError("cantidad debe ser mayor a 0.");
    }

    const { data: cab, error: eCab } = await admin
      .from("alimentaciones")
      .select("id, granja_id, turno")
      .eq("id", alimentacionId)
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eCab) return jsonError(eCab.message, 500);
    if (!cab) return jsonError("Compra no encontrada.", 404);
    if (cab.turno !== "compra") {
      return jsonError("Solo se pueden editar entregas de tipo compra.", 400);
    }

    const { data: det, error: eDet } = await admin
      .from("detalle_alimentaciones")
      .select("id, subtotal")
      .eq("alimentacion_id", alimentacionId)
      .eq("alimento_id", alimentoId)
      .maybeSingle();
    if (eDet) return jsonError(eDet.message, 500);
    if (!det) return jsonError("Detalle de compra no encontrado.", 404);

    const qty = Math.round(cantidad * 1000) / 1000;
    const subtotal = Math.round((Number(det.subtotal) || 0) * 100) / 100;
    const costoUnitario =
      qty > 0 ? Math.round((subtotal / qty) * 10000) / 10000 : subtotal;

    const { error: eUp } = await admin
      .from("detalle_alimentaciones")
      .update({
        cantidad: qty,
        costo_unitario: costoUnitario,
      })
      .eq("id", det.id);
    if (eUp) return jsonError(eUp.message, 400);

    if (qty > 1 && costoUnitario > 0 && costoUnitario <= 5_000) {
      await admin
        .from("alimentos")
        .update({
          costo_unitario: costoUnitario,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alimentoId)
        .eq("granja_id", granjaId);
    }

    return jsonOk({
      alimentacionId,
      alimentoId,
      cantidad: qty,
      costoUnitario,
      subtotal,
      priceBasis: qty > 1 && costoUnitario <= 5_000 ? "unit" : "compra",
    });
  } catch (e) {
    return jsonServerError("feeding/compras", e);
  }
}
