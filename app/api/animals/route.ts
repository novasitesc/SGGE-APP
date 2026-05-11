import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveFarmId } from "@/lib/api/farm";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAnimalToApi, type AnimalRow } from "@/lib/api/mappers";
import {
  countActiveAnimalsInModule,
  getModuleCapacity,
  getModuleIdByCode,
} from "@/lib/api/modules-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));

    const [{ data: animals, error: e1 }, { data: modules, error: e2 }] =
      await Promise.all([
        admin
          .from("animals")
          .select("*")
          .eq("farm_id", farmId)
          .order("tag_id", { ascending: true }),
        admin.from("modules").select("id, code").eq("farm_id", farmId),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const codeById = new Map(
      (modules ?? []).map((m: { id: string; code: string }) => [m.id, m.code])
    );
    const list = (animals ?? []).map((row) =>
      mapAnimalToApi(row as AnimalRow, codeById)
    );
    return jsonOk(list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  tagId?: string;
  breed?: string;
  entryDate?: string;
  initialWeight?: number;
  currentWeight?: number;
  moduleId?: string;
  status?: string;
  sex?: string;
  age?: number;
  acquisitionType?: string | null;
  invoiceFolio?: string | null;
  invoiceOrAuctionDate?: string | null;
  auctionLotNumber?: string | null;
  purchasePricePerKg?: number | null;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const farmId = await resolveFarmId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    if (!body.tagId?.trim()) return jsonError("tagId es obligatorio.");
    if (!body.breed?.trim()) return jsonError("breed es obligatorio.");
    if (!body.entryDate) return jsonError("entryDate es obligatorio.");
    if (body.initialWeight == null || body.currentWeight == null) {
      return jsonError("initialWeight y currentWeight son obligatorios.");
    }

    const moduleCode = body.moduleId?.trim() || "M1";
    const moduleUuid = await getModuleIdByCode(admin, farmId, moduleCode);
    if (!moduleUuid) return jsonError(`Módulo '${moduleCode}' no existe.`);

    const status = (body.status ?? "activo") as string;
    if (status === "activo") {
      const cap = await getModuleCapacity(admin, farmId, moduleUuid);
      const n = await countActiveAnimalsInModule(admin, farmId, moduleUuid);
      if (n >= cap) {
        return jsonError(
          `Capacidad del módulo ${moduleCode} agotada (${n}/${cap} activos).`
        );
      }
    }

    const acq = body.acquisitionType;
    const acquisitionType =
      acq === "subasta" || acq === "particular" || acq === "otro" ? acq : "subasta";

    const insert = {
      farm_id: farmId,
      tag_id: body.tagId.trim(),
      breed: body.breed.trim(),
      entry_date: body.entryDate,
      initial_weight: body.initialWeight,
      current_weight: body.currentWeight,
      module_id: moduleUuid,
      status,
      sex: body.sex === "H" ? "H" : "M",
      age_months: body.age ?? 0,
      acquisition_type: acquisitionType,
      invoice_folio: body.invoiceFolio?.trim() || null,
      invoice_or_auction_date: body.invoiceOrAuctionDate?.trim() || null,
      auction_lot_number: body.auctionLotNumber?.trim() || null,
      purchase_price_per_kg:
        body.purchasePricePerKg != null && !Number.isNaN(Number(body.purchasePricePerKg))
          ? Number(body.purchasePricePerKg)
          : null,
    };

    const { data, error } = await admin
      .from("animals")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return jsonError("Ya existe un animal con ese arete en la finca.");
      }
      return jsonError(error.message, 400);
    }

    const codeById = new Map([[moduleUuid, moduleCode]]);
    return jsonOk(mapAnimalToApi(data as AnimalRow, codeById), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
