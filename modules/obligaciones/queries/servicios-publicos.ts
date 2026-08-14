import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapServicioPublico } from "./mappers";
import type { ServicioPublico } from "../types/obligaciones.types";

const SELECT =
  "id, tipo, proveedor, numero_cuenta, periodo_inicio, periodo_fin, fecha_pago, monto, concepto, gasto_id, comprobante_id, origen";

export async function listServiciosPublicos(
  admin: SupabaseClient,
  granjaId: string
): Promise<ServicioPublico[]> {
  const { data, error } = await admin
    .from("servicios_publicos")
    .select(SELECT)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: false });
  if (error) throw new Error(error.message);
  const files = await fileNameByComprobanteIds(
    admin,
    granjaId,
    (data ?? []).map((r) => r.comprobante_id as string | null)
  );
  return (data ?? []).map((r) =>
    mapServicioPublico(
      r as Record<string, unknown>,
      r.comprobante_id ? files.get(r.comprobante_id as string) : null
    )
  );
}

export async function getServicioPublico(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<ServicioPublico | null> {
  const { data, error } = await admin
    .from("servicios_publicos")
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
  return mapServicioPublico(
    data as Record<string, unknown>,
    data.comprobante_id ? files.get(data.comprobante_id as string) : null
  );
}
