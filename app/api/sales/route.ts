import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId, isUuid } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapSaleRow } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const { data, error } = await admin
      .from("sales")
      .select("*")
      .eq("farm_id", farmId)
      .order("sale_date", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapSaleRow));
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
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
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
      .from("animals")
      .select("id, tag_id, breed, status, module_id")
      .eq("farm_id", farmId)
      .eq("id", body.animalId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!animal) return jsonError("Animal no encontrado.", 404);
    if (animal.status === "vendido") {
      return jsonError("El animal ya está vendido.", 409);
    }
    if (animal.status === "muerto") {
      return jsonError("No se puede vender un animal registrado como muerto.", 409);
    }

    let moduleCode = "";
    if (animal.module_id) {
      const { data: mod } = await admin
        .from("modules")
        .select("code")
        .eq("id", animal.module_id)
        .maybeSingle();
      moduleCode = mod?.code ?? "";
    }

    const saleRow = {
      farm_id: farmId,
      animal_id: animal.id,
      tag_id: animal.tag_id,
      breed: animal.breed,
      final_weight: body.finalWeight,
      price_per_kg: body.pricePerKg,
      sale_date: body.saleDate,
      buyer: body.buyer.trim(),
      module_code: moduleCode || "—",
    };

    const { data: sale, error: e2 } = await admin
      .from("sales")
      .insert(saleRow)
      .select("*")
      .single();
    if (e2) {
      if (e2.code === "23505") {
        return jsonError("Este animal ya tiene un registro de venta.", 409);
      }
      return jsonError(e2.message, 400);
    }

    const { error: e3 } = await admin
      .from("animals")
      .update({ status: "vendido", current_weight: body.finalWeight })
      .eq("farm_id", farmId)
      .eq("id", animal.id);
    if (e3) {
      await admin.from("sales").delete().eq("id", sale.id);
      return jsonError(`No se pudo actualizar el animal: ${e3.message}`, 500);
    }

    return jsonOk(mapSaleRow(sale), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
