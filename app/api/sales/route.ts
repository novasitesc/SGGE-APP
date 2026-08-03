import { isUuid } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapSaleRow } from "@/lib/api/mappers";
import { ANIMAL_SELECT, normalizeAnimalRow } from "@/lib/api/animales-query";
import { registrarVentaAnimal } from "@/lib/api/venta-animal";

export const dynamic = "force-dynamic";

type ClienteRel = { razon_social: string } | { razon_social: string }[] | null;

function razonSocialCliente(clientes: ClienteRel): string {
  if (!clientes) return "";
  const row = Array.isArray(clientes) ? clientes[0] : clientes;
  return row?.razon_social ?? "";
}

function mapDetalleVenta(row: Record<string, unknown>) {
  const anim = row.animales as {
    arete: string;
    razas: { nombre: string } | null;
    corrales: { codigo: string } | null;
  } | null;
  const venta = row.ventas as {
    fecha_venta: string;
    clientes: ClienteRel;
  } | null;
  return mapSaleRow({
    id: String(row.id),
    tag_id: anim?.arete ?? "",
    breed: anim?.razas?.nombre ?? "",
    final_weight: Number(row.peso_salida_kg),
    price_per_kg: Number(row.precio_kg),
    total_revenue: Number(row.subtotal),
    sale_date: venta?.fecha_venta ?? "",
    buyer: razonSocialCliente(venta?.clientes ?? null),
    module_code: anim?.corrales?.codigo ?? "—",
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const { data, error } = await admin
      .from("detalle_ventas")
      .select(
        `
        id, peso_salida_kg, precio_kg, subtotal, created_at, venta_id,
        animales ( arete, razas ( nombre ), corrales ( codigo ) ),
        ventas!inner ( fecha_venta, granja_id, clientes ( razon_social ) )
      `
      )
      .eq("ventas.granja_id", granjaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const fromDetalle = (data ?? []).map(mapDetalleVenta);
    const detalleVentaIds = new Set(
      (data ?? []).map((r) => String((r as { venta_id?: string }).venta_id ?? ""))
    );

    // Ventas por factura (comprobante) sin líneas de animal → también listarlas
    const { data: headerVentas, error: eH } = await admin
      .from("ventas")
      .select(
        `
        id, folio, fecha_venta, peso_total_kg, monto_total, created_at,
        clientes ( razon_social )
      `
      )
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("fecha_venta", { ascending: false });
    if (eH) throw new Error(eH.message);

    const fromHeader = (headerVentas ?? [])
      .filter((v) => !detalleVentaIds.has(String(v.id)))
      .map((v) => {
        const peso = Number(v.peso_total_kg) || 0;
        const monto = Number(v.monto_total) || 0;
        const buyer =
          razonSocialCliente(v.clientes as ClienteRel) ||
          "Cliente (comprobante)";
        return mapSaleRow({
          id: String(v.id),
          tag_id: v.folio?.slice(0, 20) || "—",
          breed: "Factura",
          final_weight: peso,
          price_per_kg: peso > 0 ? Math.round((monto / peso) * 100) / 100 : 0,
          total_revenue: monto,
          sale_date: v.fecha_venta ?? "",
          buyer,
          module_code: "—",
        });
      });

    const merged = [...fromDetalle, ...fromHeader].sort((a, b) =>
      b.saleDate.localeCompare(a.saleDate)
    );
    return jsonOk(merged);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  animalId?: string;
  /** Alternativa a animalId: busca el animal por arete en la granja. */
  tagId?: string;
  finalWeight?: number;
  pricePerKg?: number;
  saleDate?: string;
  buyer?: string;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PostBody;

    let animalId = body.animalId?.trim() || "";
    if (!animalId || !isUuid(animalId)) {
      const arete = body.tagId?.trim();
      if (!arete) {
        return jsonError("animalId (uuid) o tagId (arete) es obligatorio.");
      }
      const { data: byArete, error: eArete } = await admin
        .from("animales")
        .select("id")
        .eq("granja_id", granjaId)
        .ilike("arete", arete)
        .is("deleted_at", null)
        .maybeSingle();
      if (eArete) throw new Error(eArete.message);
      if (!byArete) return jsonError(`No se encontró animal con arete '${arete}'.`, 404);
      animalId = byArete.id as string;
    }
    if (body.finalWeight == null || body.finalWeight <= 0) {
      return jsonError("finalWeight debe ser > 0.");
    }
    if (body.pricePerKg == null || body.pricePerKg < 0) {
      return jsonError("pricePerKg inválido.");
    }
    if (!body.saleDate) return jsonError("saleDate es obligatorio.");
    if (!body.buyer?.trim()) return jsonError("buyer es obligatorio.");

    const { data: animal, error: e1 } = await admin
      .from("animales")
      .select(ANIMAL_SELECT)
      .eq("granja_id", granjaId)
      .eq("id", animalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const a = normalizeAnimalRow(animal as Record<string, unknown>);
    const estadoCodigo = a.estados_animales?.codigo;
    if (estadoCodigo === "vendido") {
      return jsonError("El animal ya está vendido.", 409);
    }
    if (estadoCodigo === "muerto") {
      return jsonError("No se puede vender un animal registrado como muerto.", 409);
    }

    const saleResult = await registrarVentaAnimal(admin, granjaId, {
      animalId,
      arete: a.arete,
      finalWeight: body.finalWeight,
      pricePerKg: body.pricePerKg,
      saleDate: body.saleDate,
      buyer: body.buyer.trim(),
      wasActivo: estadoCodigo === "activo",
      corralId: a.corral_id,
    });
    if (!saleResult.ok) {
      return jsonError(saleResult.message, saleResult.status);
    }

    const { data: detalle, error: eDetalle } = await admin
      .from("detalle_ventas")
      .select(
        `
        id, peso_salida_kg, precio_kg, subtotal,
        animales ( arete, razas ( nombre ), corrales ( codigo ) ),
        ventas ( fecha_venta, clientes ( razon_social ) )
      `
      )
      .eq("id", saleResult.detalleId)
      .single();
    if (eDetalle) return jsonError(eDetalle.message, 500);

    return jsonOk(mapDetalleVenta(detalle as Record<string, unknown>), {
      status: 201,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
