import type { SupabaseClient } from "@supabase/supabase-js";
import { fileNameByComprobanteIds, mapPoliza, mapPolizaPago } from "./mappers";
import type { Poliza, PolizaPago } from "../types/obligaciones.types";

const SELECT_POLIZA =
  "id, aseguradora, numero_poliza, tipo, vigencia_desde, vigencia_hasta, prima_total, estado, notas";
const SELECT_PAGO =
  "id, poliza_id, fecha, monto, periodo_desde, periodo_hasta, concepto, gasto_id, comprobante_id, origen";

export async function listPolizas(
  admin: SupabaseClient,
  granjaId: string
): Promise<Poliza[]> {
  const { data: polizas, error } = await admin
    .from("polizas")
    .select(SELECT_POLIZA)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .order("numero_poliza", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (polizas ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data: pagos, error: ePagos } = await admin
    .from("poliza_pagos")
    .select(SELECT_PAGO)
    .eq("granja_id", granjaId)
    .in("poliza_id", ids)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });
  if (ePagos) throw new Error(ePagos.message);

  const files = await fileNameByComprobanteIds(
    admin,
    granjaId,
    (pagos ?? []).map((p) => p.comprobante_id as string | null)
  );

  const byPoliza = new Map<string, PolizaPago[]>();
  for (const row of pagos ?? []) {
    const mapped = mapPolizaPago(
      row as Record<string, unknown>,
      row.comprobante_id ? files.get(row.comprobante_id as string) : null
    );
    const list = byPoliza.get(mapped.polizaId) ?? [];
    list.push(mapped);
    byPoliza.set(mapped.polizaId, list);
  }

  return (polizas ?? []).map((p) =>
    mapPoliza(p as Record<string, unknown>, byPoliza.get(p.id as string) ?? [])
  );
}

export async function getPoliza(
  admin: SupabaseClient,
  granjaId: string,
  id: string
): Promise<Poliza | null> {
  const all = await listPolizas(admin, granjaId);
  return all.find((p) => p.id === id) ?? null;
}
