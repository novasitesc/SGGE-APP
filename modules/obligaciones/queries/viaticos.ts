import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapViatico } from "./mappers";
import type { Viatico } from "../types/obligaciones.types";

const SELECT =
  "id, empleado_id, empleado_nombre, fecha, destino, motivo, monto, gasto_id, comprobante_id, origen";

export async function listViaticos(
  admin: SupabaseClient,
  granjaId: string
): Promise<Viatico[]> {
  const { data, error } = await admin
    .from("viaticos")
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
    mapViatico(
      r as Record<string, unknown>,
      r.comprobante_id ? files.get(r.comprobante_id as string) : null
    )
  );
}

export async function getViatico(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<Viatico | null> {
  const { data, error } = await admin
    .from("viaticos")
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
  return mapViatico(
    data as Record<string, unknown>,
    data.comprobante_id ? files.get(data.comprobante_id as string) : null
  );
}
