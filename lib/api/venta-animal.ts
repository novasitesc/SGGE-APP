import type { SupabaseClient } from "@supabase/supabase-js";
import { getSystemUserId } from "@/lib/api/granja";
import { getEstadoIdByCodigo, adjustCorralOcupacion } from "@/lib/api/corrales-helpers";
import { registrarHistorialAnimal } from "@/lib/api/historial-animal";
import {
  registrarHistorial,
  snapshotVenta,
} from "@/lib/api/historial-sistema";

export type RegistrarVentaInput = {
  animalId: string;
  arete?: string;
  finalWeight: number;
  pricePerKg: number;
  saleDate: string;
  buyer: string;
  wasActivo: boolean;
  corralId: string | null;
};

export type RegistrarVentaResult =
  | { ok: true; ventaId: string; detalleId: string; subtotal: number }
  | { ok: false; message: string; status: number };

export async function registrarVentaAnimal(
  admin: SupabaseClient,
  granjaId: string,
  input: RegistrarVentaInput
): Promise<RegistrarVentaResult> {
  const { animalId, finalWeight, pricePerKg, saleDate, buyer, wasActivo, corralId } =
    input;

  if (finalWeight <= 0) {
    return { ok: false, message: "El peso de salida debe ser > 0.", status: 400 };
  }
  if (pricePerKg < 0) {
    return { ok: false, message: "El precio por kg no es válido.", status: 400 };
  }
  if (!buyer.trim()) {
    return { ok: false, message: "El comprador es obligatorio.", status: 400 };
  }

  const { data: existing } = await admin
    .from("detalle_ventas")
    .select("id")
    .eq("animal_id", animalId)
    .maybeSingle();
  if (existing) {
    return { ok: false, message: "Este animal ya tiene registro de venta.", status: 409 };
  }

  let { data: cliente } = await admin
    .from("clientes")
    .select("id")
    .eq("granja_id", granjaId)
    .ilike("razon_social", buyer.trim())
    .is("deleted_at", null)
    .maybeSingle();

  if (!cliente) {
    const { data: nuevo, error: ec } = await admin
      .from("clientes")
      .insert({
        granja_id: granjaId,
        razon_social: buyer.trim(),
        canal_venta: "nacional",
      })
      .select("id")
      .single();
    if (ec) return { ok: false, message: ec.message, status: 400 };
    cliente = nuevo;
  }

  const subtotal = Math.round(finalWeight * pricePerKg * 100) / 100;
  const folio = `VTA-${saleDate.replace(/-/g, "")}-${animalId.slice(0, 8)}`;

  const { data: venta, error: eVenta } = await admin
    .from("ventas")
    .insert({
      granja_id: granjaId,
      cliente_id: cliente!.id,
      folio,
      fecha_venta: saleDate,
      canal_venta: "nacional",
      peso_total_kg: finalWeight,
      monto_total: subtotal,
    })
    .select("id")
    .single();
  if (eVenta) return { ok: false, message: eVenta.message, status: 400 };

  const { data: detalle, error: eDetalle } = await admin
    .from("detalle_ventas")
    .insert({
      venta_id: venta.id,
      animal_id: animalId,
      peso_salida_kg: finalWeight,
      precio_kg: pricePerKg,
      subtotal,
    })
    .select("id")
    .single();
  if (eDetalle) {
    await admin.from("ventas").delete().eq("id", venta.id);
    return { ok: false, message: eDetalle.message, status: 400 };
  }

  const estadoVendido = await getEstadoIdByCodigo(admin, "vendido");
  if (!estadoVendido) {
    await admin.from("detalle_ventas").delete().eq("id", detalle.id);
    await admin.from("ventas").delete().eq("id", venta.id);
    return { ok: false, message: "Estado 'vendido' no configurado.", status: 500 };
  }

  await admin.from("pesajes").insert({
    animal_id: animalId,
    fecha_pesaje: saleDate,
    peso_kg: finalWeight,
    tipo_pesaje: "salida",
    registrado_por_id: getSystemUserId(),
  });

  const { error: eAnimal } = await admin
    .from("animales")
    .update({
      estado_id: estadoVendido,
      peso_actual_kg: finalWeight,
      updated_at: new Date().toISOString(),
    })
    .eq("id", animalId);
  if (eAnimal) {
    await admin.from("detalle_ventas").delete().eq("id", detalle.id);
    await admin.from("ventas").delete().eq("id", venta.id);
    return { ok: false, message: eAnimal.message, status: 500 };
  }

  if (corralId && wasActivo) {
    await adjustCorralOcupacion(admin, corralId, -1);
  }

  await registrarHistorialAnimal(admin, {
    granjaId,
    animalId,
    arete: input.arete ?? animalId.slice(0, 8),
    accion: "vender",
    resumen: `Venta registrada: ${finalWeight} kg a ₡${pricePerKg}/kg — comprador: ${buyer.trim()}. Total: ₡${subtotal}.`,
    datosNuevos: {
      fechaVenta: saleDate,
      comprador: buyer.trim(),
      pesoSalidaKg: finalWeight,
      precioKg: pricePerKg,
      total: subtotal,
      ventaId: venta.id,
    },
  });

  await registrarHistorial(admin, {
    granjaId,
    modulo: "ventas",
    registroId: venta.id,
    referencia: input.arete ?? folio,
    accion: "crear",
    resumen: `Venta ${folio}: arete ${input.arete ?? "—"}, ${finalWeight} kg, total ₡${subtotal} — ${buyer.trim()}.`,
    datosNuevos: snapshotVenta({
      arete: input.arete ?? "—",
      comprador: buyer.trim(),
      pesoKg: finalWeight,
      precioKg: pricePerKg,
      total: subtotal,
      fecha: saleDate,
      folio,
    }),
  });

  return {
    ok: true,
    ventaId: venta.id,
    detalleId: detalle.id,
    subtotal,
  };
}

export type ActualizarVentaInput = {
  finalWeight?: number;
  pricePerKg?: number;
  saleDate?: string;
  buyer?: string;
};

export type ActualizarVentaResult =
  | { ok: true; detalleId: string; subtotal: number }
  | { ok: false; message: string; status: number };

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function actualizarVentaDetalle(
  admin: SupabaseClient,
  granjaId: string,
  detalleId: string,
  input: ActualizarVentaInput
): Promise<ActualizarVentaResult> {
  const { data: detalle, error: e0 } = await admin
    .from("detalle_ventas")
    .select(
      `
      id, animal_id, peso_salida_kg, precio_kg, subtotal, venta_id,
      ventas!inner ( id, granja_id, folio, fecha_venta, cliente_id )
    `
    )
    .eq("id", detalleId)
    .maybeSingle();
  if (e0) return { ok: false, message: e0.message, status: 500 };
  if (!detalle) return { ok: false, message: "Venta no encontrada.", status: 404 };

  const venta = one(
    detalle.ventas as
      | {
          id: string;
          granja_id: string;
          folio: string;
          fecha_venta: string;
          cliente_id: string;
        }
      | {
          id: string;
          granja_id: string;
          folio: string;
          fecha_venta: string;
          cliente_id: string;
        }[]
      | null
  );
  if (!venta || venta.granja_id !== granjaId) {
    return { ok: false, message: "Venta no encontrada.", status: 404 };
  }

  const finalWeight =
    input.finalWeight != null
      ? Number(input.finalWeight)
      : Number(detalle.peso_salida_kg);
  const pricePerKg =
    input.pricePerKg != null
      ? Number(input.pricePerKg)
      : Number(detalle.precio_kg);
  const saleDate = input.saleDate?.trim() || venta.fecha_venta;

  if (finalWeight <= 0) {
    return { ok: false, message: "El peso de salida debe ser > 0.", status: 400 };
  }
  if (pricePerKg < 0) {
    return { ok: false, message: "El precio por kg no es válido.", status: 400 };
  }

  const subtotal = Math.round(finalWeight * pricePerKg * 100) / 100;
  let clienteId = venta.cliente_id;

  if (input.buyer?.trim()) {
    const buyer = input.buyer.trim();
    let { data: cliente } = await admin
      .from("clientes")
      .select("id")
      .eq("granja_id", granjaId)
      .ilike("razon_social", buyer)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cliente) {
      const { data: nuevo, error: ec } = await admin
        .from("clientes")
        .insert({
          granja_id: granjaId,
          razon_social: buyer,
          canal_venta: "nacional",
        })
        .select("id")
        .single();
      if (ec) return { ok: false, message: ec.message, status: 400 };
      cliente = nuevo;
    }
    clienteId = cliente!.id;
  }

  const { error: eDet } = await admin
    .from("detalle_ventas")
    .update({
      peso_salida_kg: finalWeight,
      precio_kg: pricePerKg,
      subtotal,
    })
    .eq("id", detalleId);
  if (eDet) return { ok: false, message: eDet.message, status: 400 };

  const { error: eVenta } = await admin
    .from("ventas")
    .update({
      fecha_venta: saleDate,
      peso_total_kg: finalWeight,
      monto_total: subtotal,
      cliente_id: clienteId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", venta.id);
  if (eVenta) return { ok: false, message: eVenta.message, status: 400 };

  const animalId = detalle.animal_id as string;
  await admin
    .from("animales")
    .update({
      peso_actual_kg: finalWeight,
      updated_at: new Date().toISOString(),
    })
    .eq("id", animalId);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "ventas",
    registroId: venta.id,
    referencia: venta.folio,
    accion: "modificar",
    resumen: `Venta actualizada: ${finalWeight} kg a ₡${pricePerKg}/kg — total ₡${subtotal}.`,
    datosNuevos: snapshotVenta({
      arete: "—",
      comprador: input.buyer?.trim() ?? "—",
      pesoKg: finalWeight,
      precioKg: pricePerKg,
      total: subtotal,
      fecha: saleDate,
      folio: venta.folio,
    }),
  });

  return { ok: true, detalleId, subtotal };
}

export type RevertirVentaResult =
  | { ok: true }
  | { ok: false; message: string; status: number };

/** Elimina el detalle de venta y revierte el animal a activo. */
export async function revertirVentaAnimal(
  admin: SupabaseClient,
  granjaId: string,
  detalleId: string
): Promise<RevertirVentaResult> {
  const { data: detalle, error: e0 } = await admin
    .from("detalle_ventas")
    .select(
      `
      id, animal_id, peso_salida_kg, precio_kg, subtotal, venta_id,
      ventas!inner ( id, granja_id, folio, fecha_venta ),
      animales ( id, arete, corral_id )
    `
    )
    .eq("id", detalleId)
    .maybeSingle();
  if (e0) return { ok: false, message: e0.message, status: 500 };
  if (!detalle) return { ok: false, message: "Venta no encontrada.", status: 404 };

  const venta = one(
    detalle.ventas as
      | { id: string; granja_id: string; folio: string; fecha_venta: string }
      | { id: string; granja_id: string; folio: string; fecha_venta: string }[]
      | null
  );
  if (!venta || venta.granja_id !== granjaId) {
    return { ok: false, message: "Venta no encontrada.", status: 404 };
  }

  const animal = one(
    detalle.animales as
      | { id: string; arete: string; corral_id: string | null }
      | { id: string; arete: string; corral_id: string | null }[]
      | null
  );

  const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
  if (!estadoActivo) {
    return { ok: false, message: "Estado 'activo' no configurado.", status: 500 };
  }

  if (animal) {
    await admin
      .from("animales")
      .update({
        estado_id: estadoActivo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", animal.id);

    if (animal.corral_id) {
      await adjustCorralOcupacion(admin, animal.corral_id, 1);
    }

    await registrarHistorialAnimal(admin, {
      granjaId,
      animalId: animal.id,
      arete: animal.arete,
      accion: "modificar",
      resumen: `Venta revertida (detalle eliminado). Animal vuelve a activo.`,
      datosNuevos: { ventaRevertidaId: venta.id },
    });
  }

  const { error: eDel } = await admin
    .from("detalle_ventas")
    .delete()
    .eq("id", detalleId);
  if (eDel) return { ok: false, message: eDel.message, status: 400 };

  const { count } = await admin
    .from("detalle_ventas")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", venta.id);

  if ((count ?? 0) === 0) {
    await admin.from("ventas").delete().eq("id", venta.id);
  }

  await registrarHistorial(admin, {
    granjaId,
    modulo: "ventas",
    registroId: venta.id,
    referencia: animal?.arete ?? venta.folio,
    accion: "eliminar",
    resumen: `Venta eliminada${animal ? `: arete ${animal.arete}` : ""}.`,
    datosAnteriores: snapshotVenta({
      arete: animal?.arete ?? "—",
      comprador: "—",
      pesoKg: Number(detalle.peso_salida_kg),
      precioKg: Number(detalle.precio_kg),
      total: Number(detalle.subtotal),
      fecha: venta.fecha_venta,
      folio: venta.folio,
    }),
  });

  return { ok: true };
}

/** Actualiza una venta de cabecera (sin detalle/animal), p. ej. desde factura PDF. */
export async function actualizarVentaCabecera(
  admin: SupabaseClient,
  granjaId: string,
  ventaId: string,
  input: ActualizarVentaInput
): Promise<ActualizarVentaResult> {
  const { data: venta, error: e0 } = await admin
    .from("ventas")
    .select("id, granja_id, folio, fecha_venta, cliente_id, peso_total_kg, monto_total")
    .eq("id", ventaId)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (e0) return { ok: false, message: e0.message, status: 500 };
  if (!venta) return { ok: false, message: "Venta no encontrada.", status: 404 };

  const { count } = await admin
    .from("detalle_ventas")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", ventaId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "Esta venta tiene detalle de animales; edítala por el detalle.",
      status: 400,
    };
  }

  const peso =
    input.finalWeight != null ? Number(input.finalWeight) : Number(venta.peso_total_kg);
  const saleDate = input.saleDate?.trim() || venta.fecha_venta;
  let monto = Number(venta.monto_total);
  if (input.pricePerKg != null && peso > 0) {
    monto = Math.round(peso * Number(input.pricePerKg) * 100) / 100;
  } else if (input.finalWeight != null && Number(venta.peso_total_kg) > 0) {
    const ratio = Number(venta.monto_total) / Number(venta.peso_total_kg);
    monto = Math.round(peso * ratio * 100) / 100;
  }

  let clienteId = venta.cliente_id;
  if (input.buyer?.trim()) {
    const buyer = input.buyer.trim();
    let { data: cliente } = await admin
      .from("clientes")
      .select("id")
      .eq("granja_id", granjaId)
      .ilike("razon_social", buyer)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cliente) {
      const { data: nuevo, error: ec } = await admin
        .from("clientes")
        .insert({
          granja_id: granjaId,
          razon_social: buyer,
          canal_venta: "nacional",
        })
        .select("id")
        .single();
      if (ec) return { ok: false, message: ec.message, status: 400 };
      cliente = nuevo;
    }
    clienteId = cliente!.id;
  }

  const { error: eVenta } = await admin
    .from("ventas")
    .update({
      fecha_venta: saleDate,
      peso_total_kg: peso,
      monto_total: monto,
      cliente_id: clienteId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ventaId);
  if (eVenta) return { ok: false, message: eVenta.message, status: 400 };

  await admin
    .from("facturas")
    .update({ monto, fecha_emision: saleDate })
    .eq("venta_id", ventaId)
    .eq("tipo", "ingreso");

  return { ok: true, detalleId: ventaId, subtotal: monto };
}

/** Elimina una venta de cabecera (sin animales) y desvincula factura/comprobante. */
export async function eliminarVentaCabecera(
  admin: SupabaseClient,
  granjaId: string,
  ventaId: string
): Promise<RevertirVentaResult> {
  const { data: venta, error: e0 } = await admin
    .from("ventas")
    .select("id, granja_id, folio, fecha_venta, monto_total, peso_total_kg")
    .eq("id", ventaId)
    .eq("granja_id", granjaId)
    .maybeSingle();
  if (e0) return { ok: false, message: e0.message, status: 500 };
  if (!venta) return { ok: false, message: "Venta no encontrada.", status: 404 };

  const { count } = await admin
    .from("detalle_ventas")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", ventaId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "Esta venta tiene animales; elimínala desde el detalle.",
      status: 400,
    };
  }

  const { data: facturas } = await admin
    .from("facturas")
    .select("id")
    .eq("venta_id", ventaId);
  const facturaIds = (facturas ?? []).map((f) => f.id);

  if (facturaIds.length > 0) {
    await admin
      .from("comprobantes")
      .update({ factura_id: null, estado: "pendiente", clasificacion: "venta" })
      .in("factura_id", facturaIds);
    await admin.from("facturas").delete().in("id", facturaIds);
  }

  const { error: eDel } = await admin.from("ventas").delete().eq("id", ventaId);
  if (eDel) return { ok: false, message: eDel.message, status: 400 };

  await registrarHistorial(admin, {
    granjaId,
    modulo: "ventas",
    registroId: ventaId,
    referencia: venta.folio,
    accion: "eliminar",
    resumen: `Venta (factura) eliminada: folio ${venta.folio}, ₡${venta.monto_total}.`,
    datosAnteriores: snapshotVenta({
      arete: "—",
      comprador: "—",
      pesoKg: Number(venta.peso_total_kg),
      precioKg: 0,
      total: Number(venta.monto_total),
      fecha: venta.fecha_venta,
      folio: venta.folio,
    }),
  });

  return { ok: true };
}
