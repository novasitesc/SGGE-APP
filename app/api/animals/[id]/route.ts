import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId, isUuid } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAnimalToApi, type AnimalRow } from "@/lib/api/mappers";
import {
  countActiveAnimalsInModule,
  getModuleCapacity,
  getModuleIdByCode,
} from "@/lib/api/modules-helpers";

export const dynamic = "force-dynamic";

type PatchBody = Partial<{
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: number;
  currentWeight: number;
  moduleId: string;
  status: string;
  sex: string;
  age: number;
  acquisitionType: string | null;
  invoiceFolio: string | null;
  invoiceOrAuctionDate: string | null;
  auctionLotNumber: string | null;
  purchasePricePerKg: number | null;
}>;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de animal inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("animals")
      .select("*")
      .eq("farm_id", farmId)
      .eq("id", id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Animal no encontrado.", 404);

    let moduleUuid: string | null = current.module_id;

    if (body.moduleId != null) {
      const code = body.moduleId.trim();
      const found = await getModuleIdByCode(admin, farmId, code);
      if (!found) return jsonError(`Módulo '${code}' no existe.`);
      moduleUuid = found;
    }

    const nextStatus = (body.status ?? current.status) as string;
    const nextModuleId =
      body.moduleId != null ? moduleUuid : (current.module_id as string | null);

    if (nextStatus === "activo" && nextModuleId) {
      const cap = await getModuleCapacity(admin, farmId, nextModuleId);
      const others = await countActiveAnimalsInModule(
        admin,
        farmId,
        nextModuleId,
        id
      );
      if (others + 1 > cap) {
        const { data: mod } = await admin
          .from("modules")
          .select("code")
          .eq("id", nextModuleId)
          .maybeSingle();
        return jsonError(
          `Capacidad del módulo ${mod?.code ?? ""} agotada (${others + 1}/${cap}).`
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (body.tagId != null) patch.tag_id = body.tagId.trim();
    if (body.breed != null) patch.breed = body.breed.trim();
    if (body.entryDate != null) patch.entry_date = body.entryDate;
    if (body.initialWeight != null) patch.initial_weight = body.initialWeight;
    if (body.currentWeight != null) patch.current_weight = body.currentWeight;
    if (body.moduleId != null) patch.module_id = moduleUuid;
    if (body.status != null) patch.status = body.status;
    if (body.sex != null) patch.sex = body.sex === "H" ? "H" : "M";
    if (body.age != null) patch.age_months = body.age;
    if (body.acquisitionType != null) {
      const a = body.acquisitionType;
      if (a === "subasta" || a === "particular" || a === "otro") {
        patch.acquisition_type = a;
      }
    }
    if (body.invoiceFolio !== undefined) {
      patch.invoice_folio = body.invoiceFolio?.trim() || null;
    }
    if (body.invoiceOrAuctionDate !== undefined) {
      patch.invoice_or_auction_date = body.invoiceOrAuctionDate?.trim() || null;
    }
    if (body.auctionLotNumber !== undefined) {
      patch.auction_lot_number = body.auctionLotNumber?.trim() || null;
    }
    if (body.purchasePricePerKg !== undefined) {
      patch.purchase_price_per_kg =
        body.purchasePricePerKg != null && !Number.isNaN(Number(body.purchasePricePerKg))
          ? Number(body.purchasePricePerKg)
          : null;
    }

    const { data, error } = await admin
      .from("animals")
      .update(patch)
      .eq("farm_id", farmId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return jsonError("Ya existe un animal con ese arete en la finca.");
      }
      return jsonError(error.message, 400);
    }

    const { data: modules } = await admin
      .from("modules")
      .select("id, code")
      .eq("farm_id", farmId);
    const codeById = new Map(
      (modules ?? []).map((m: { id: string; code: string }) => [m.id, m.code])
    );
    return jsonOk(mapAnimalToApi(data as AnimalRow, codeById));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de animal inválido.");

    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const { error } = await admin
      .from("animals")
      .delete()
      .eq("farm_id", farmId)
      .eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return jsonError(
          "No se puede eliminar: el animal tiene ventas u otras referencias.",
          409
        );
      }
      return jsonError(error.message, 400);
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
