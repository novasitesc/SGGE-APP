
import { requireApiContext } from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";
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
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const loteId = url.searchParams.get("loteId")?.trim() || null;

    const desde30 = new Date();
    desde30.setUTCDate(desde30.getUTCDate() - 30);
    const desde30Iso = desde30.toISOString().slice(0, 10);

    let animalsQuery = admin
      .from("animales")
      .select(ANIMAL_SELECT)
      .eq("granja_id", granjaId)
      .is("deleted_at", null);
    if (loteId) animalsQuery = animalsQuery.eq("lote_id", loteId);

    let alimQuery = admin
      .from("alimentaciones")
      .select("id, fecha, costo_total, turno, lote_id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .gte("fecha", desde30Iso);
    if (loteId) alimQuery = alimQuery.eq("lote_id", loteId);

    const [
      { data: animals, error: e1 },
      { data: gastos },
      { data: ventas },
      { data: alimCab },
    ] = await Promise.all([
      animalsQuery,
      // Gastos: siempre a nivel granja (compartidos entre lotes).
      admin
        .from("gastos")
        .select("monto, fecha, categorias_gastos(codigo)")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("ventas")
        .select("id, monto_total, fecha_venta")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      alimQuery,
    ]);
    if (e1) throw new Error(e1.message);

    const list = (animals ?? []).map((row) =>
      normalizeAnimalRow(row as Record<string, unknown>)
    );
    const animalIds = new Set(list.map((a) => a.id));
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
    // Costos de granja: compartidos entre lotes (no se segmentan).
    const totalCost = (gastos ?? []).reduce(
      (s: number, c: { monto: number }) => s + Number(c.monto),
      0
    );

    // Ingresos: si hay lote activo, solo ventas de animales de ese lote.
    let totalRevenue = (ventas ?? []).reduce(
      (s: number, v: { monto_total: number }) => s + Number(v.monto_total),
      0
    );
    if (loteId) {
      if (animalIds.size === 0) {
        totalRevenue = 0;
      } else {
        const { data: detLote } = await admin
          .from("detalle_ventas")
          .select("subtotal, animal_id")
          .in("animal_id", [...animalIds]);
        totalRevenue = (detLote ?? []).reduce(
          (s, d) => s + Number((d as { subtotal: number }).subtotal),
          0
        );
      }
    }

    // Costos ALIM reales (gastos 30d) — prioriza comprobantes confirmados.
    const alimGastos30 = (gastos ?? []).reduce((s, c) => {
      const cat = c.categorias_gastos as
        | { codigo: string }
        | { codigo: string }[]
        | null;
      const codigo = Array.isArray(cat) ? cat[0]?.codigo : cat?.codigo;
      if (codigo !== "ALIM") return s;
      const fecha = (c as { fecha?: string }).fecha;
      if (fecha && fecha < desde30Iso) return s;
      return s + Number(c.monto);
    }, 0);

    // Solo raciones (excluye turno=compra = facturas ALIM sincronizadas).
    const racionCabs = (alimCab ?? []).filter(
      (r: { turno?: string | null }) => r.turno !== "compra"
    );
    const alimIds = racionCabs.map((r: { id: string }) => r.id);
    let feedKg30 = 0;
    if (alimIds.length > 0) {
      const { data: dets } = await admin
        .from("detalle_alimentaciones")
        .select("cantidad")
        .in("alimentacion_id", alimIds);
      feedKg30 = (dets ?? []).reduce(
        (s, d) => s + Number((d as { cantidad: number }).cantidad),
        0
      );
    }

    const alimCostoEntregas30 = racionCabs.reduce(
      (s, r: { costo_total: number }) => s + Number(r.costo_total),
      0
    );

    // Preferir gasto ALIM contabilizado; si no hay, usar entregas sincronizadas.
    const feedCost30 =
      alimGastos30 > 0 ? alimGastos30 : alimCostoEntregas30;
    const feedCostApproxDay = feedCost30 / 30;

    const feedConversionRatio =
      totalGainKg > 0 && feedKg30 > 0 ? feedKg30 / totalGainKg : 0;

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

    let salesDetailQuery = admin
      .from("detalle_ventas")
      .select(
        `
        id, peso_salida_kg, precio_kg, subtotal, venta_id, created_at, animal_id,
        animales ( arete, lote_id, razas ( nombre ), corrales ( codigo ) ),
        ventas ( fecha_venta, clientes ( razon_social ) )
      `
      )
      .eq("ventas.granja_id", granjaId)
      .order("created_at", { ascending: false })
      .limit(loteId ? 24 : 4);
    if (loteId && animalIds.size > 0) {
      salesDetailQuery = salesDetailQuery.in("animal_id", [...animalIds]);
    }

    const { data: salesDetailRaw } = await salesDetailQuery;
    const salesDetail =
      loteId && animalIds.size === 0
        ? []
        : (salesDetailRaw ?? []).slice(0, 4);

    const fromDetalle = salesDetail.map(
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

    const detalleVentaIds = new Set(
      (salesDetail ?? []).map((r) => String((r as { venta_id?: string }).venta_id ?? ""))
    );

    // Facturas sin detalle de animal: solo en vista de granja (sin lote).
    let fromHeader: ReturnType<typeof mapSaleRow>[] = [];
    if (!loteId) {
      const { data: headerRecent } = await admin
        .from("ventas")
        .select(
          "id, folio, fecha_venta, peso_total_kg, monto_total, clientes ( razon_social )"
        )
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .order("fecha_venta", { ascending: false })
        .limit(4);

      fromHeader = (headerRecent ?? [])
        .filter((v) => !detalleVentaIds.has(String(v.id)))
        .map((v) => {
          const peso = Number(v.peso_total_kg) || 0;
          const monto = Number(v.monto_total) || 0;
          const clienteRaw = v.clientes as
            | { razon_social: string }
            | { razon_social: string }[]
            | null;
          const cliente = Array.isArray(clienteRaw) ? clienteRaw[0] : clienteRaw;
          return mapSaleRow({
            id: String(v.id),
            tag_id: v.folio?.slice(0, 20) || "—",
            breed: "Factura",
            final_weight: peso,
            price_per_kg: peso > 0 ? Math.round((monto / peso) * 100) / 100 : 0,
            total_revenue: monto,
            sale_date: v.fecha_venta ?? "",
            buyer: cliente?.razon_social ?? "Cliente (comprobante)",
            module_code: "—",
          });
        });
    }

    const recentSales = [...fromDetalle, ...fromHeader]
      .sort((a, b) => b.saleDate.localeCompare(a.saleDate))
      .slice(0, 4);

    const labels: Record<string, string> = {
      ALIM: "Alimentación",
      FERT: "Abono y fertilizantes",
      HERB: "Herbicidas",
      MO: "Mano de Obra",
      TRANS: "Transporte",
      VET: "Veterinaria",
      COMB: "Combustible",
      MANT: "Mantenimiento",
      SERV: "Servicios",
      SPUB: "Servicios públicos",
      POL: "Pólizas",
      CCSS: "CCSS",
      SAL: "Salarios",
      VIAT: "Viáticos",
      OTRO: "Otros",
    };
    const colors: Record<string, string> = {
      Alimentación: "#16a34a",
      "Abono y fertilizantes": "#65a30d",
      Herbicidas: "#15803d",
      "Mano de Obra": "#2563eb",
      Transporte: "#d97706",
      Veterinaria: "#7c3aed",
      Combustible: "#d97706",
      Mantenimiento: "#64748b",
      Servicios: "#0891b2",
      "Servicios públicos": "#0369a1",
      Pólizas: "#4338ca",
      CCSS: "#0f766e",
      Salarios: "#1d4ed8",
      Viáticos: "#a21caf",
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

    let healthAlerts: {
      id: string;
      animalId?: string | null;
      tagId?: string | null;
      type: string;
      message: string;
      dueDate: string;
      priority: string;
    }[] = [];
    try {
      const { listAlertas } = await import("@/modules/salud");
      healthAlerts = await listAlertas(admin, granjaId, { limit: 8 });
      if (loteId) {
        healthAlerts = healthAlerts.filter(
          (a) => !a.animalId || animalIds.has(a.animalId)
        );
      }
    } catch {
      healthAlerts = [];
    }

    return jsonOk({
      kpiSummary,
      recentAnimals,
      recentSales,
      healthAlerts,
      costsByCategory,
      /** true = gastos/costos son de toda la granja aunque el lote filtre animales */
      costsSharedAcrossLotes: true,
      loteId,
    });
  } catch (e) {
    return jsonServerError("dashboard", e);
  }
}
