import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId, getSystemUserId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAnimalToApi } from "@/lib/api/mappers";
import {
  ANIMAL_SELECT,
  findRazaId,
  getDefaultCategoriaId,
  getDefaultLoteId,
  normalizeAnimalRow,
  type AnimalRowSrrg,
} from "@/lib/api/animales-query";
import {
  countActiveAnimalsInCorral,
  getCorralCapacity,
  getCorralIdByCodigo,
  getEstadoIdByCodigo,
  adjustCorralOcupacion,
} from "@/lib/api/corrales-helpers";
import {
  buildCambiosResumen,
  registrarHistorialAnimal,
  snapshotFromAnimalRow,
  snapshotFromApiBody,
} from "@/lib/api/historial-animal";
import { registrarCompraAnimal, fetchComprasForAnimals } from "@/lib/api/compra-animal";
import { createActaAnimal } from "@/lib/api/actas-animal";
import { normalizeWeightKg } from "@/lib/api/weight-utils";
import { upsertPesajeAnimal } from "@/lib/api/pesaje-utils";
import type { AcquisitionType } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data, error } = await admin
      .from("animales")
      .select(ANIMAL_SELECT)
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("arete", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((row) =>
      normalizeAnimalRow(row as Record<string, unknown>)
    );
    const detalleIds = rows
      .map((r) => r.compra_detalle_id)
      .filter((id): id is string => !!id);
    const compras = await fetchComprasForAnimals(admin, detalleIds);

    return jsonOk(
      rows.map((row) =>
        mapAnimalToApi(row, row.compra_detalle_id ? compras.get(row.compra_detalle_id) : null)
      )
    );
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
  observaciones?: string;
  acquisitionType?: AcquisitionType;
  purchasePricePerKg?: number;
  invoiceFolio?: string;
  invoiceOrAuctionDate?: string;
  auctionLotNumber?: string;
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

    if (!body.tagId?.trim()) return jsonError("tagId es obligatorio.");
    if (!body.breed?.trim()) return jsonError("breed es obligatorio.");
    if (!body.entryDate) return jsonError("entryDate es obligatorio.");
    if (body.initialWeight == null || body.currentWeight == null) {
      return jsonError("initialWeight y currentWeight son obligatorios.");
    }
    if (body.purchasePricePerKg == null || body.purchasePricePerKg < 0) {
      return jsonError("purchasePricePerKg es obligatorio (precio de compra ₡/kg).");
    }

    const corralCodigo = body.moduleId?.trim() || "M1";
    const corralId = await getCorralIdByCodigo(admin, granjaId, corralCodigo);
    if (!corralId) return jsonError(`Corral '${corralCodigo}' no existe.`);

    const statusCodigo = body.status ?? "activo";
    const estadoId = await getEstadoIdByCodigo(admin, statusCodigo);
    if (!estadoId) return jsonError(`Estado '${statusCodigo}' no existe.`);

    if (statusCodigo === "activo") {
      const cap = await getCorralCapacity(admin, granjaId, corralId);
      const n = await countActiveAnimalsInCorral(admin, granjaId, corralId);
      if (n >= cap) {
        return jsonError(
          `Capacidad del corral ${corralCodigo} agotada (${n}/${cap} activos).`
        );
      }
    }

    const razaId = await findRazaId(admin, granjaId, body.breed);
    if (!razaId) {
      return jsonError(
        `Raza '${body.breed}' no encontrada. Configúrela en Administración.`
      );
    }

    const categoriaId = await getDefaultCategoriaId(admin, granjaId);
    const loteId = await getDefaultLoteId(admin, granjaId);
    const pesoInicial = normalizeWeightKg(body.initialWeight);
    const pesoActual = normalizeWeightKg(body.currentWeight);
    const systemUser = getSystemUserId();

    let fechaNacimiento: string | null = null;
    if (body.age != null && body.age > 0) {
      const d = new Date(body.entryDate + "T12:00:00Z");
      d.setMonth(d.getMonth() - body.age);
      fechaNacimiento = d.toISOString().slice(0, 10);
    }

    const { data, error } = await admin
      .from("animales")
      .insert({
        granja_id: granjaId,
        arete: body.tagId.trim(),
        raza_id: razaId,
        sexo: body.sex === "H" ? "H" : "M",
        fecha_nacimiento: fechaNacimiento,
        fecha_ingreso: body.entryDate,
        peso_inicial_kg: pesoInicial,
        peso_actual_kg: pesoActual,
        categoria_id: categoriaId,
        estado_id: estadoId,
        lote_id: loteId,
        corral_id: corralId,
        observaciones: null,
      })
      .select(ANIMAL_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("Ya existe un animal con ese arete en la granja.");
      }
      return jsonError(error.message, 400);
    }

    const pesajeResult = await upsertPesajeAnimal(admin, {
      animalId: data.id,
      fechaPesaje: body.entryDate,
      pesoKg: pesoActual,
      tipoPesaje: "ingreso",
      registradoPorId: systemUser,
    });
    if (!pesajeResult.ok) {
      await admin.from("animales").delete().eq("id", data.id);
      return jsonError(pesajeResult.message, 400);
    }

    if (statusCodigo === "activo") {
      await adjustCorralOcupacion(admin, corralId, 1);
    }

    const created = normalizeAnimalRow(data as Record<string, unknown>);

    const compraResult = await registrarCompraAnimal(admin, {
      granjaId,
      animalId: created.id,
      arete: created.arete,
      pesoCompraKg: pesoInicial,
      precioKg: body.purchasePricePerKg!,
      fechaCompra: body.invoiceOrAuctionDate ?? body.entryDate,
      tipoAdquisicion: body.acquisitionType ?? "particular",
      folio: body.invoiceFolio,
      loteSubasta: body.auctionLotNumber,
    });
    if (!compraResult.ok) {
      await admin.from("animales").delete().eq("id", created.id);
      return jsonError(compraResult.message, compraResult.status);
    }

    const { data: refreshed } = await admin
      .from("animales")
      .select(ANIMAL_SELECT)
      .eq("id", created.id)
      .single();
    const finalRow = normalizeAnimalRow((refreshed ?? data) as Record<string, unknown>);

    const snap = snapshotFromAnimalRow(finalRow);
    const costoTotal = Math.round(pesoInicial * body.purchasePricePerKg! * 100) / 100;
    await registrarHistorialAnimal(admin, {
      granjaId,
      animalId: finalRow.id,
      arete: finalRow.arete,
      accion: "crear",
      resumen: `Alta en inventario: arete ${finalRow.arete}, raza ${snap.raza}, corral ${snap.corral}, peso ${snap.pesoActualKg} kg, compra ₡${body.purchasePricePerKg}/kg (total ₡${costoTotal}).`,
      datosNuevos: {
        ...snap,
        precioCompraKg: body.purchasePricePerKg,
        costoTotalCompra: costoTotal,
        tipoAdquisicion: body.acquisitionType ?? "particular",
      },
    });

    if (body.observaciones?.trim()) {
      await createActaAnimal(admin, {
        granjaId,
        animalId: finalRow.id,
        arete: finalRow.arete,
        fecha: body.entryDate,
        texto: body.observaciones.trim(),
      }).catch(() => {});
    }

    const compraMap = await fetchComprasForAnimals(admin, [compraResult.detalleId]);
    const purchase = compraMap.get(compraResult.detalleId);

    return jsonOk(mapAnimalToApi(finalRow, purchase), {
      status: 201,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
