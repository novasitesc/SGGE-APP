import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getEstadoIdByCodigo } from "@/lib/api/corrales-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const estadoActivo = await getEstadoIdByCodigo(admin, "activo");

    const [{ count: activeHead }, { data: alimentos, error: e2 }] =
      await Promise.all([
        admin
          .from("animales")
          .select("id", { count: "exact", head: true })
          .eq("granja_id", granjaId)
          .eq("estado_id", estadoActivo)
          .is("deleted_at", null),
        admin
          .from("alimentos")
          .select("*")
          .eq("granja_id", granjaId)
          .eq("activo", true)
          .is("deleted_at", null)
          .order("nombre", { ascending: true }),
      ]);
    if (e2) throw new Error(e2.message);

    const heads = activeHead ?? 0;
    const rows = alimentos ?? [];
    const defaultDailyPerHead = rows.length > 0 ? 12 / rows.length : 0;
    const sumDaily = defaultDailyPerHead * rows.length;

    const feedTypes = rows.map((r: Record<string, unknown>) => {
      const daily = defaultDailyPerHead;
      const price = Number(r.costo_unitario);
      const monthlyAmount = daily * 30 * heads;
      const monthlyCost = monthlyAmount * price;
      const pct =
        sumDaily > 0 ? Math.round((daily / sumDaily) * 1000) / 10 : 0;
      return {
        id: r.id as string,
        name: r.nombre as string,
        unit: r.unidad_medida as string,
        dailyConsumption: Math.round(daily * 100) / 100,
        pricePerUnit: price,
        monthlyAmount: Math.round(monthlyAmount * 100) / 100,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        percentage: pct,
      };
    });

    return jsonOk({ activeHeadCount: heads, feedTypes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
