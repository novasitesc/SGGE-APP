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
