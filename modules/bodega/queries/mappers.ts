import type { SupabaseClient } from "@supabase/supabase-js";
import type { BodegaCompra, OrigenBodega } from "../types/bodega.types";
import type { BodegaLinea } from "../types/bodega.types";

export function mapBodegaCompra(
  row: Record<string, unknown>,
  fileName?: string | null
): BodegaCompra {
  const cantidad = row.cantidad != null ? Number(row.cantidad) : null;
  return {
    id: row.id as string,
    linea: row.linea as BodegaLinea,
    fecha: row.fecha as string,
    proveedor: (row.proveedor as string) ?? "",
    producto: (row.producto as string) ?? "",
    cantidad: Number.isFinite(cantidad) ? cantidad : null,
    unidad: (row.unidad as string) ?? "kg",
    monto: Number(row.monto),
    concepto: (row.concepto as string) ?? "",
    gastoId: (row.gasto_id as string | null) ?? null,
    comprobanteId: (row.comprobante_id as string | null) ?? null,
    origen: row.origen === "comprobante" ? "comprobante" : ("manual" as OrigenBodega),
    fileName: fileName ?? null,
  };
}

export async function fileNameByComprobanteIds(
  admin: SupabaseClient,
  granjaId: string,
  ids: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await admin
    .from("comprobantes")
    .select("id, archivo_nombre")
    .eq("granja_id", granjaId)
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, row.archivo_nombre as string);
  }
  return map;
}
