import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapSalario } from "./mappers";
import type { Salario } from "../types/obligaciones.types";

const SELECT =
  "id, empleado_id, empleado_nombre, periodo_inicio, periodo_fin, tipo, monto, fecha_pago, concepto, gasto_id, comprobante_id, origen";

export async function listSalarios(
  admin: SupabaseClient,
  granjaId: string
): Promise<Salario[]> {
  const { data, error } = await admin
    .from("salarios")
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
    mapSalario(
      r as Record<string, unknown>,
      r.comprobante_id ? files.get(r.comprobante_id as string) : null
    )
  );
}

export async function getSalario(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<Salario | null> {
  const { data, error } = await admin
    .from("salarios")
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
  return mapSalario(
    data as Record<string, unknown>,
    data.comprobante_id ? files.get(data.comprobante_id as string) : null
  );
}
