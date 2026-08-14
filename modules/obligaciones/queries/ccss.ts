import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapAporteCcss } from "./mappers";
import type { AporteCcss } from "../types/obligaciones.types";

const SELECT =
  "id, periodo, tipo, numero_patrono, fecha_pago, monto, concepto, gasto_id, comprobante_id, origen";

export async function listAportesCcss(
  admin: SupabaseClient,
  granjaId: string
): Promise<AporteCcss[]> {
  const { data, error } = await admin
    .from("aportes_ccss")
    .select(SELECT)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("periodo", { ascending: false })
    .order("fecha_pago", { ascending: false });
  if (error) throw new Error(error.message);
  const files = await fileNameByComprobanteIds(
    admin,
    granjaId,
    (data ?? []).map((r) => r.comprobante_id as string | null)
  );
  return (data ?? []).map((r) =>
    mapAporteCcss(
      r as Record<string, unknown>,
      r.comprobante_id ? files.get(r.comprobante_id as string) : null
    )
  );
}

export async function getAporteCcss(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<AporteCcss | null> {
  const { data, error } = await admin
    .from("aportes_ccss")
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
  return mapAporteCcss(
    data as Record<string, unknown>,
    data.comprobante_id ? files.get(data.comprobante_id as string) : null
  );
}
