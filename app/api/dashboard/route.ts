import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapAnimalToApi, mapSaleRow } from "@/lib/api/mappers";
import { ANIMAL_SELECT, normalizeAnimalRow } from "@/lib/api/animales-query";

export const dynamic = "force-dynamic";

function daysBetween(startIso: string, end: Date): number {
  const a = new Date(startIso + "T12:00:00Z").getTime();
  const b = end.getTime();
  return Math.max(1, Math.round((b - a) / (86400 * 1000)));
}

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const [
      { data: animals, error: e1 },
      { data: gastos },
      { data: ventas },
      { data: alimentos },
    ] = await Promise.all([
      admin
        .from("animales")
        .select(ANIMAL_SELECT)
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("gastos")
        .select("monto, categorias_gastos(codigo)")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("ventas")
        .select("id, monto_total, fecha_venta")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("alimentos")
        .select("costo_unitario")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .eq("activo", true),
    ]);
    if (e1) throw new Error(e1.message);

    const list = (animals ?? []).map((row) =>
      normalizeAnimalRow(row as Record<string, unknown>)
    );
    const active = list.filter(
      (a) => a.estados_animales?.codigo === "activo"
    );
    const now = new Date();
    const totalAnimals = list.length;
    const activeAnimals = active.length;

    const avgCurrentWeight =
      activeAnimals > 0
        ? active.reduce((s, a) => s + Number(a.peso_actual_kg), 0) /
          activeAnimals
        : 0;

    const gains = active.map((a) => {
      const gain = Number(a.peso_actual_kg) - Number(a.peso_inicial_kg);
      const days = daysBetween(a.fecha_ingreso, now);
      return { gain, days, daily: gain / days };
    });
    const avgDailyGain =
      gains.length > 0
        ? gains.reduce((s, g) => s + g.daily, 0) / gains.length
        : 0;

    const totalGainKg = gains.reduce((s, g) => s + g.gain, 0);
    const totalCost = (gastos ?? []).reduce(
      (s: number, c: { monto: number }) => s + Number(c.monto),
      0
    );
    const totalRevenue = (ventas ?? []).reduce(
      (s: number, v: { monto_total: number }) => s + Number(v.monto_total),
      0
    );

    const avgFeedPrice =
      (alimentos ?? []).length > 0
        ? (alimentos ?? []).reduce(
            (s: number, r: { costo_unitario: number }) =>
              s + Number(r.costo_unitario),
            0
          ) / (alimentos ?? []).length
        : 0;
    const feedCostApproxDay = avgFeedPrice * 12 * activeAnimals;

    const feedConversionRatio =
      totalGainKg > 0 && activeAnimals > 0
        ? (12 * activeAnimals * 30) / totalGainKg
        : 0;

    const costPerKg = totalGainKg > 0 ? totalCost / totalGainKg : totalCost;
    const netProfit = totalRevenue - totalCost;
    const profitability = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    const kpiSummary = {
      totalAnimals,
      activeAnimals,
      avgCurrentWeight: Math.round(avgCurrentWeight * 10) / 10,
      avgDailyGain: Math.round(avgDailyGain * 100) / 100,
      feedConversionRatio: Math.round(feedConversionRatio * 10) / 10,
      costPerKg: Math.round(costPerKg * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitability: Math.round(profitability * 10) / 10,
      feedCostApproxPerDay: Math.round(feedCostApproxDay * 100) / 100,
    };

    const recentAnimals = [...list]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5)
      .map((row) => mapAnimalToApi(row));

    const { data: salesDetail } = await admin
      .from("detalle_ventas")
      .select(
        `
        id, peso_salida_kg, precio_kg, subtotal,
        animales ( arete, razas ( nombre ), corrales ( codigo ) ),
        ventas ( fecha_venta, clientes ( razon_social ) )
      `
      )
      .eq("ventas.granja_id", granjaId)
      .order("created_at", { ascending: false })
      .limit(4);

    const recentSales = (salesDetail ?? []).map(
      (row: Record<string, unknown>) => {
        const anim = row.animales as {
          arete: string;
          razas: { nombre: string } | null;
          corrales: { codigo: string } | null;
        } | null;
        const venta = row.ventas as {
          fecha_venta: string;
          clientes: { razon_social: string } | null;
        } | null;
        return mapSaleRow({
          id: String(row.id),
          tag_id: anim?.arete ?? "",
          breed: anim?.razas?.nombre ?? "",
          final_weight: Number(row.peso_salida_kg),
          price_per_kg: Number(row.precio_kg),
          total_revenue: Number(row.subtotal),
          sale_date: venta?.fecha_venta ?? "",
          buyer: venta?.clientes?.razon_social ?? "",
          module_code: anim?.corrales?.codigo ?? "—",
        });
      }
    );

    const labels: Record<string, string> = {
      ALIM: "Alimentación",
      MO: "Mano de Obra",
      TRANS: "Transporte",
      VET: "Veterinaria",
      COMB: "Combustible",
      MANT: "Mantenimiento",
      SERV: "Servicios",
      OTRO: "Otros",
    };
    const colors: Record<string, string> = {
      Alimentación: "#16a34a",
      "Mano de Obra": "#2563eb",
      Transporte: "#d97706",
      Veterinaria: "#7c3aed",
      Combustible: "#d97706",
      Mantenimiento: "#64748b",
      Servicios: "#0891b2",
      Otros: "#6b7280",
    };
    const costsByCategoryMap = new Map<string, number>();
    for (const c of gastos ?? []) {
      const catRaw = (c as Record<string, unknown>).categorias_gastos;
      const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
      const codigo = (cat as { codigo?: string } | null)?.codigo;
      const label = labels[codigo ?? "OTRO"] ?? codigo ?? "Otros";
      costsByCategoryMap.set(
        label,
        (costsByCategoryMap.get(label) ?? 0) + Number((c as { monto: number }).monto)
      );
    }
    const costsByCategory = [...costsByCategoryMap.entries()].map(
      ([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        color: colors[category] ?? "#6b7280",
      })
    );

    return jsonOk({
      kpiSummary,
      recentAnimals,
      recentSales,
      healthAlerts: [],
      costsByCategory,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
