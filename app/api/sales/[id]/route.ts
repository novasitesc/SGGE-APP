import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { mapSaleRow } from "@/lib/api/mappers";
import {
  actualizarVentaCabecera,
  actualizarVentaDetalle,
  eliminarVentaCabecera,
  revertirVentaAnimal,
} from "@/lib/api/venta-animal";

export const dynamic = "force-dynamic";

function mapDetalleVenta(row: Record<string, unknown>) {
  const anim = row.animales as {
    arete: string;
    razas: { nombre: string } | null;
    corrales: { codigo: string } | null;
  } | null;
  const venta = row.ventas as {
    fecha_venta: string;
    clientes: { razon_social: string } | null;
  } | null;
  return mapSaleRow({
    id: String(row.id),
    tag_id: anim?.arete ?? "",
    breed: anim?.razas?.nombre ?? "",
    final_weight: Number(row.peso_salida_kg),
    price_per_kg: Number(row.precio_kg),
    total_revenue: Number(row.subtotal),
    sale_date: venta?.fecha_venta ?? "",
    buyer: venta?.clientes?.razon_social ?? "",
    module_code: anim?.corrales?.codigo ?? "—",
  });
}

const DETALLE_SELECT = `
  id, peso_salida_kg, precio_kg, subtotal,
  animales ( arete, razas ( nombre ), corrales ( codigo ) ),
  ventas ( fecha_venta, clientes ( razon_social ) )
`;

type PatchBody = {
  finalWeight?: number;
  pricePerKg?: number;
  saleDate?: string;
  buyer?: string;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PatchBody;

    // 1) Detalle con animal
    const result = await actualizarVentaDetalle(admin, granjaId, id, body);
    if (result.ok) {
      const { data: detalle, error } = await admin
        .from("detalle_ventas")
        .select(DETALLE_SELECT)
        .eq("id", id)
        .single();
      if (error) return jsonError(error.message, 500);
      return jsonOk(mapDetalleVenta(detalle as Record<string, unknown>));
    }

    // 2) Venta solo-cabecera (factura PDF sin arete)
    if (result.status === 404) {
      const cab = await actualizarVentaCabecera(admin, granjaId, id, body);
      if (!cab.ok) return jsonError(cab.message, cab.status);

      const { data: venta, error: eV } = await admin
        .from("ventas")
        .select(
          "id, folio, fecha_venta, peso_total_kg, monto_total, clientes ( razon_social )"
        )
        .eq("id", id)
        .single();
      if (eV) return jsonError(eV.message, 500);
      const peso = Number(venta.peso_total_kg) || 0;
      const monto = Number(venta.monto_total) || 0;
      const clienteRaw = venta.clientes as
        | { razon_social: string }
        | { razon_social: string }[]
        | null;
      const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] : clienteRaw;
      return jsonOk(
        mapSaleRow({
          id: String(venta.id),
          tag_id: venta.folio?.slice(0, 20) || "—",
          breed: "Factura",
          final_weight: peso,
          price_per_kg: peso > 0 ? Math.round((monto / peso) * 100) / 100 : 0,
          total_revenue: monto,
          sale_date: venta.fecha_venta ?? "",
          buyer: cliente?.razon_social ?? "",
          module_code: "—",
        })
      );
    }

    return jsonError(result.message, result.status);
  } catch (e) {
    return jsonServerError("sales/[id]", e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireApiContext(_req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const result = await revertirVentaAnimal(admin, granjaId, id);
    if (result.ok) return jsonOk({ ok: true });

    if (result.status === 404) {
      const cab = await eliminarVentaCabecera(admin, granjaId, id);
      if (!cab.ok) return jsonError(cab.message, cab.status);
      return jsonOk({ ok: true });
    }

    return jsonError(result.message, result.status);
  } catch (e) {
    return jsonServerError("sales/[id]", e);
  }
}
