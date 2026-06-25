import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getEstadoIdByCodigo } from "@/lib/api/corrales-helpers";

export const dynamic = "force-dynamic";

const PERIOD_DAYS = 30;

function periodStartIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - PERIOD_DAYS);
  return d.toISOString().slice(0, 10);
}

type ConsumoRow = {
  alimento_id: string;
  total_cantidad: number;
  total_costo: number;
};

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
    const desde = periodStartIso();

    const estadoActivo = await getEstadoIdByCodigo(admin, "activo");

    const [
      { count: activeHead },
      { data: alimentos, error: eAlimentos },
      { data: detalle, error: eDetalle },
      { data: fechas, error: eFechas },
    ] = await Promise.all([
      admin
        .from("animales")
        .select("id", { count: "exact", head: true })
        .eq("granja_id", granjaId)
        .eq("estado_id", estadoActivo)
        .is("deleted_at", null),
      admin
        .from("alimentos")
        .select("id, nombre, unidad_medida, costo_unitario")
        .eq("granja_id", granjaId)
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre", { ascending: true }),
      admin
        .from("detalle_alimentaciones")
        .select(
          `
          alimento_id,
          cantidad,
          subtotal,
          alimentaciones!inner ( granja_id, fecha, deleted_at )
        `
        )
        .eq("alimentaciones.granja_id", granjaId)
        .is("alimentaciones.deleted_at", null)
        .gte("alimentaciones.fecha", desde),
      admin
        .from("alimentaciones")
        .select("fecha")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .gte("fecha", desde),
    ]);

    if (eAlimentos) throw new Error(eAlimentos.message);
    if (eDetalle) throw new Error(eDetalle.message);
    if (eFechas) throw new Error(eFechas.message);

    const heads = activeHead ?? 0;
    const rows = alimentos ?? [];

    const consumoMap = new Map<string, ConsumoRow>();
    for (const row of detalle ?? []) {
      const r = row as Record<string, unknown>;
      const aid = r.alimento_id as string;
      const cur = consumoMap.get(aid) ?? {
        alimento_id: aid,
        total_cantidad: 0,
        total_costo: 0,
      };
      cur.total_cantidad += Number(r.cantidad);
      cur.total_costo += Number(r.subtotal);
      consumoMap.set(aid, cur);
    }

    const distinctDays = new Set(
      (fechas ?? []).map((f: { fecha: string }) => f.fecha)
    ).size;
    const daysInPeriod = distinctDays > 0 ? distinctDays : PERIOD_DAYS;
    const animalDays = heads > 0 ? heads * daysInPeriod : 0;

    let totalDailyKg = 0;

    const feedTypes = rows.map((r: Record<string, unknown>) => {
      const id = r.id as string;
      const consumo = consumoMap.get(id);
      const price = Number(r.costo_unitario);
      const unit = r.unidad_medida as string;

      const totalQty = consumo?.total_cantidad ?? 0;
      const totalCost = consumo?.total_costo ?? 0;

      const dailyConsumption =
        animalDays > 0
          ? Math.round((totalQty / animalDays) * 100) / 100
          : 0;
      const monthlyAmount =
        heads > 0
          ? Math.round(dailyConsumption * PERIOD_DAYS * heads * 100) / 100
          : 0;
      const monthlyCost = Math.round(totalCost * 100) / 100;

      totalDailyKg += dailyConsumption;

      return {
        id,
        name: r.nombre as string,
        unit,
        dailyConsumption,
        pricePerUnit: price,
        monthlyAmount,
        monthlyCost,
        percentage: 0,
        hasConsumption: totalQty > 0,
      };
    });

    const sumDaily = feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);
    for (const f of feedTypes) {
      f.percentage =
        sumDaily > 0 ? Math.round((f.dailyConsumption / sumDaily) * 1000) / 10 : 0;
    }

    return jsonOk({
      activeHeadCount: heads,
      periodDays: PERIOD_DAYS,
      daysWithRecords: distinctDays,
      hasConsumptionRecords: (detalle ?? []).length > 0,
      feedTypes: feedTypes.map(({ hasConsumption: _, ...rest }) => rest),
      totalDailyConsumption: Math.round(totalDailyKg * 100) / 100,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
