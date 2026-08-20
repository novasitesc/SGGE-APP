import type { SupabaseClient } from "@supabase/supabase-js";
import { esCodigoBodega, lineaDesdeCodigo, type BodegaLinea } from "../types/bodega.types";
import { inferLineaBodega, inferProductoBodega } from "./parse-text";

export type SyncBodegaInput = {
  granjaId: string;
  gastoId: string;
  fecha: string;
  monto: number;
  concepto: string;
  emisorNombre?: string | null;
  comprobanteId?: string | null;
  texto?: string;
  linea?: BodegaLinea | null;
  producto?: string | null;
  proveedor?: string | null;
  cantidad?: number | null;
  unidad?: string | null;
};

async function alreadyLinked(
  admin: SupabaseClient,
  gastoId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("bodega_compras")
    .select("id")
    .eq("gasto_id", gastoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function sincronizarBodegaDesdeGasto(
  admin: SupabaseClient,
  codigo: string,
  input: SyncBodegaInput
): Promise<void> {
  if (!esCodigoBodega(codigo)) return;
  if (await alreadyLinked(admin, input.gastoId)) return;

  const blob = `${input.texto ?? ""} ${input.concepto} ${input.emisorNombre ?? ""}`;
  const linea =
    input.linea ??
    inferLineaBodega(blob) ??
    lineaDesdeCodigo(codigo);
  const producto =
    input.producto?.trim() ||
    inferProductoBodega(blob, input.concepto);
  const proveedor = (input.proveedor ?? input.emisorNombre ?? "Proveedor bodega").slice(0, 120);

  const { error } = await admin.from("bodega_compras").insert({
    granja_id: input.granjaId,
    linea,
    fecha: input.fecha,
    proveedor,
    producto: producto.slice(0, 120),
    cantidad: input.cantidad != null && input.cantidad > 0 ? input.cantidad : null,
    unidad: input.unidad?.trim() || "kg",
    monto: input.monto,
    concepto: input.concepto.slice(0, 255),
    gasto_id: input.gastoId,
    comprobante_id: input.comprobanteId ?? null,
    origen: "comprobante",
  });
  if (error) throw new Error(error.message);
}
