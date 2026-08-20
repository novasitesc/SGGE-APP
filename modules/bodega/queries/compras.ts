import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapBodegaCompra } from "./mappers";
import type { BodegaCompra } from "../types/bodega.types";

const SELECT =
  "id, linea, fecha, proveedor, producto, cantidad, unidad, monto, concepto, gasto_id, comprobante_id, origen";

export async function listBodegaCompras(
  admin: SupabaseClient,
  granjaId: string
): Promise<BodegaCompra[]> {
  const { data, error } = await admin
    .from("bodega_compras")
    .select(SELECT)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  const files = await fileNameByComprobanteIds(
    admin,
    granjaId,
    (data ?? []).map((r) => r.comprobante_id as string | null)
  );
  return (data ?? []).map((r) =>
    mapBodegaCompra(
      r as Record<string, unknown>,
      r.comprobante_id ? files.get(r.comprobante_id as string) : null
    )
  );
}

export async function getBodegaCompra(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<BodegaCompra | null> {
  const { data, error } = await admin
    .from("bodega_compras")
    .select(SELECT)
    .eq("granja_id", granjaId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const files = await fileNameByComprobanteIds(admin, granjaId, [
    data.comprobante_id as string | null,
  ]);
  return mapBodegaCompra(
    data as Record<string, unknown>,
    data.comprobante_id ? files.get(data.comprobante_id as string) : null
  );
}
