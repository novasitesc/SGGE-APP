import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcquisitionType } from "@/lib/types/domain";
import { ApiError } from "@/lib/api/errors";

const PROVEEDOR_DEMO_ID = "11111111-1111-1111-1111-111111111111";

export type CompraAnimalInput = {
  granjaId: string;
  animalId: string;
  arete: string;
  pesoCompraKg: number;
  precioKg: number;
  fechaCompra: string;
  tipoAdquisicion?: AcquisitionType;
  folio?: string | null;
  loteSubasta?: string | null;
};

export type CompraAnimalInfo = {
  pricePerKg: number;
  totalCost: number;
  purchaseWeightKg: number;
  purchaseDate: string;
  acquisitionType: string;
  folio?: string;
  auctionLotNumber?: string;
};

export function mapCompraToApi(row: {
  precio_kg: number;
  subtotal: number;
  peso_compra_kg: number;
  lote_subasta?: string | null;
  compras_animales?: {
    fecha_compra: string;
    tipo_adquisicion: string;
    folio: string;
  } | {
    fecha_compra: string;
    tipo_adquisicion: string;
    folio: string;
  }[] | null;
}): CompraAnimalInfo {
  const compraRaw = row.compras_animales;
  const compra = Array.isArray(compraRaw) ? compraRaw[0] : compraRaw;
  return {
    pricePerKg: Number(row.precio_kg),
    totalCost: Number(row.subtotal),
    purchaseWeightKg: Number(row.peso_compra_kg),
    purchaseDate: compra?.fecha_compra ?? "",
    acquisitionType: compra?.tipo_adquisicion ?? "particular",
    folio: compra?.folio,
    auctionLotNumber: row.lote_subasta ?? undefined,
  };
}

async function resolveProveedorId(
  admin: SupabaseClient,
  granjaId: string
): Promise<string> {
  const { data: demo } = await admin
    .from("proveedores")
    .select("id")
    .eq("id", PROVEEDOR_DEMO_ID)
    .eq("granja_id", granjaId)
    .maybeSingle();
  if (demo?.id) return demo.id;

  const { data: anyProv } = await admin
    .from("proveedores")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("activo", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (anyProv?.id) return anyProv.id;

  throw new ApiError("No hay proveedores configurados en la granja.", 409);
}

function buildFolio(arete: string, folio?: string | null): string {
  if (folio?.trim()) return folio.trim().slice(0, 50);
  const safe = arete.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
  return `INV-${safe}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

export async function registrarCompraAnimal(
  admin: SupabaseClient,
  input: CompraAnimalInput
): Promise<{ ok: true; detalleId: string } | { ok: false; message: string; status: number }> {
  const {
    granjaId,
    animalId,
    arete,
    pesoCompraKg,
    precioKg,
    fechaCompra,
    tipoAdquisicion = "particular",
    folio,
    loteSubasta,
  } = input;

  if (precioKg < 0) {
    return { ok: false, message: "El precio de compra por kg no es válido.", status: 400 };
  }
  if (pesoCompraKg <= 0) {
    return { ok: false, message: "El peso de compra debe ser mayor a 0.", status: 400 };
  }

  const subtotal = Math.round(pesoCompraKg * precioKg * 100) / 100;
  const folioFinal = buildFolio(arete, folio);

  try {
    const proveedorId = await resolveProveedorId(admin, granjaId);

    const { data: compra, error: compraError } = await admin
      .from("compras_animales")
      .insert({
        granja_id: granjaId,
        proveedor_id: proveedorId,
        folio: folioFinal,
        fecha_compra: fechaCompra,
        tipo_adquisicion: tipoAdquisicion,
        peso_total_kg: pesoCompraKg,
        monto_total: subtotal,
        observaciones: `Compra vinculada al animal ${arete}`,
      })
      .select("id")
      .single();

    if (compraError) {
      if (compraError.code === "23505") {
        return {
          ok: false,
          message: "Ya existe una compra con ese folio. Indique otro folio de factura.",
          status: 409,
        };
      }
      return { ok: false, message: compraError.message, status: 400 };
    }

    const { data: detalle, error: detalleError } = await admin
      .from("detalle_compras")
      .insert({
        compra_id: compra.id,
        arete_referencia: arete,
        peso_compra_kg: pesoCompraKg,
        precio_kg: precioKg,
        subtotal,
        lote_subasta: loteSubasta?.trim() || null,
      })
      .select("id")
      .single();

    if (detalleError) {
      await admin.from("compras_animales").delete().eq("id", compra.id);
      return { ok: false, message: detalleError.message, status: 400 };
    }

    const { error: linkAnimalError } = await admin
      .from("animales")
      .update({ compra_detalle_id: detalle.id })
      .eq("id", animalId)
      .eq("granja_id", granjaId);

    if (linkAnimalError) {
      await admin.from("detalle_compras").delete().eq("id", detalle.id);
      await admin.from("compras_animales").delete().eq("id", compra.id);
      return { ok: false, message: linkAnimalError.message, status: 400 };
    }

    const { error: linkDetalleError } = await admin
      .from("detalle_compras")
      .update({ animal_id: animalId })
      .eq("id", detalle.id);

    if (linkDetalleError) {
      return { ok: false, message: linkDetalleError.message, status: 400 };
    }

    return { ok: true, detalleId: detalle.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al registrar compra";
    if (msg.includes("compras_animales") || msg.includes("does not exist")) {
      return {
        ok: false,
        message:
          "Tablas de compras no configuradas. Ejecute docs/database/schema.sql en Supabase.",
        status: 503,
      };
    }
    return { ok: false, message: msg, status: 500 };
  }
}

/**
 * Actualiza la compra vinculada al animal, o la crea si aún no existe.
 * El peso de compra se alinea con el peso inicial del animal.
 */
export async function actualizarCompraAnimal(
  admin: SupabaseClient,
  input: CompraAnimalInput & { compraDetalleId: string | null }
): Promise<{ ok: true; detalleId: string } | { ok: false; message: string; status: number }> {
  const {
    granjaId,
    animalId,
    arete,
    pesoCompraKg,
    precioKg,
    fechaCompra,
    tipoAdquisicion = "particular",
    folio,
    loteSubasta,
    compraDetalleId,
  } = input;

  if (precioKg < 0) {
    return { ok: false, message: "El precio de compra por kg no es válido.", status: 400 };
  }
  if (pesoCompraKg <= 0) {
    return { ok: false, message: "El peso de compra debe ser mayor a 0.", status: 400 };
  }

  if (!compraDetalleId) {
    return registrarCompraAnimal(admin, {
      granjaId,
      animalId,
      arete,
      pesoCompraKg,
      precioKg,
      fechaCompra,
      tipoAdquisicion,
      folio,
      loteSubasta,
    });
  }

  const subtotal = Math.round(pesoCompraKg * precioKg * 100) / 100;
  const folioFinal = buildFolio(arete, folio);

  const { data: detalle, error: detalleFetchError } = await admin
    .from("detalle_compras")
    .select("id, compra_id")
    .eq("id", compraDetalleId)
    .maybeSingle();

  if (detalleFetchError) {
    return { ok: false, message: detalleFetchError.message, status: 400 };
  }
  if (!detalle?.compra_id) {
    return registrarCompraAnimal(admin, {
      granjaId,
      animalId,
      arete,
      pesoCompraKg,
      precioKg,
      fechaCompra,
      tipoAdquisicion,
      folio,
      loteSubasta,
    });
  }

  const { error: detalleError } = await admin
    .from("detalle_compras")
    .update({
      arete_referencia: arete,
      peso_compra_kg: pesoCompraKg,
      precio_kg: precioKg,
      subtotal,
      lote_subasta: loteSubasta?.trim() || null,
      animal_id: animalId,
    })
    .eq("id", compraDetalleId);

  if (detalleError) {
    return { ok: false, message: detalleError.message, status: 400 };
  }

  const { error: compraError } = await admin
    .from("compras_animales")
    .update({
      folio: folioFinal,
      fecha_compra: fechaCompra,
      tipo_adquisicion: tipoAdquisicion,
      peso_total_kg: pesoCompraKg,
      monto_total: subtotal,
      observaciones: `Compra vinculada al animal ${arete}`,
    })
    .eq("id", detalle.compra_id)
    .eq("granja_id", granjaId);

  if (compraError) {
    if (compraError.code === "23505") {
      return {
        ok: false,
        message: "Ya existe una compra con ese folio. Indique otro folio de factura.",
        status: 409,
      };
    }
    return { ok: false, message: compraError.message, status: 400 };
  }

  return { ok: true, detalleId: compraDetalleId };
}

export async function fetchCompraForAnimal(
  admin: SupabaseClient,
  compraDetalleId: string | null
): Promise<CompraAnimalInfo | null> {
  if (!compraDetalleId) return null;

  const { data, error } = await admin
    .from("detalle_compras")
    .select(
      "precio_kg, subtotal, peso_compra_kg, lote_subasta, compras_animales ( folio, fecha_compra, tipo_adquisicion )"
    )
    .eq("id", compraDetalleId)
    .maybeSingle();

  if (error || !data) return null;
  return mapCompraToApi(data);
}

export async function fetchComprasForAnimals(
  admin: SupabaseClient,
  detalleIds: string[]
): Promise<Map<string, CompraAnimalInfo>> {
  const map = new Map<string, CompraAnimalInfo>();
  if (detalleIds.length === 0) return map;

  const { data } = await admin
    .from("detalle_compras")
    .select(
      "id, precio_kg, subtotal, peso_compra_kg, lote_subasta, compras_animales ( folio, fecha_compra, tipo_adquisicion )"
    )
    .in("id", detalleIds);

  for (const row of data ?? []) {
    map.set(row.id as string, mapCompraToApi(row));
  }
  return map;
}
