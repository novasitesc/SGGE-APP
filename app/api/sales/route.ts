import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, isUuid } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapSaleRow } from "@/lib/api/mappers";
import { ANIMAL_SELECT, normalizeAnimalRow } from "@/lib/api/animales-query";
import { registrarVentaAnimal } from "@/lib/api/venta-animal";

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

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data, error } = await admin
      .from("detalle_ventas")
      .select(
        `
        id, peso_salida_kg, precio_kg, subtotal, created_at,
        animales ( arete, razas ( nombre ), corrales ( codigo ) ),
        ventas!inner ( fecha_venta, granja_id, clientes ( razon_social ) )
      `
      )
      .eq("ventas.granja_id", granjaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapDetalleVenta));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  animalId?: string;
  finalWeight?: number;
  pricePerKg?: number;
  saleDate?: string;
  buyer?: string;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
    const body = (await req.json()) as PostBody;

    if (!body.animalId || !isUuid(body.animalId)) {
      return jsonError("animalId (uuid) es obligatorio.");
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
      .eq("id", body.animalId)
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
      animalId: body.animalId,
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
