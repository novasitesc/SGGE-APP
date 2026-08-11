import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getEstadoIdByCodigo } from "@/lib/api/corrales-helpers";
import { getDefaultLoteId, listOpenLotes } from "@/lib/api/animales-query";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { esUnidadMasa, labelUnidad } from "@/lib/api/unidades-medida";

export const dynamic = "force-dynamic";

/** Horizonte por defecto: 30 días. Override: ?days=30|90|180|365|730|all */
const DEFAULT_PERIOD_DAYS = 30;
const MIN_PERIOD_DAYS = 7;
const MAX_PERIOD_DAYS = 1095;

function resolvePeriod(raw: string | null): {
  days: number;
  allTime: boolean;
} {
  if (raw === "all" || raw === "0") {
    return { days: MAX_PERIOD_DAYS, allTime: true };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { days: DEFAULT_PERIOD_DAYS, allTime: false };
  }
  return {
    days: Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, Math.round(n))),
    allTime: false,
  };
}

function periodStartIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type ConsumoRow = {
  alimento_id: string;
  total_cantidad: number;
  total_costo: number;
};

type CabRow = {
  id: string;
  fecha: string;
  turno?: string | null;
  costo_total: number;
  observaciones?: string | null;
};

type PurchaseHistoryItem = {
  id: string;
  alimentacionId: string;
  fecha: string;
  alimentoId: string;
  alimentoNombre: string;
  cantidad: number;
  unidad: string;
  costo: number;
  origen: string;
};

function origenDesdeObservaciones(obs: string | null | undefined): string {
  if (!obs?.trim()) return "Compra registrada";
  // "Compra desde comprobante · gasto:uuid · Nombre"
  const parts = obs.split("·").map((p) => p.trim());
  if (parts.length >= 3) return `PDF · ${parts[parts.length - 1]}`;
  if (obs.toLowerCase().includes("comprobante")) return "PDF · comprobante ALIM";
  return obs.length > 72 ? `${obs.slice(0, 72)}…` : obs;
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const { days: periodDays, allTime } = resolvePeriod(
      url.searchParams.get("days")
    );
    const loteId = url.searchParams.get("loteId")?.trim() || null;
    const desde = allTime ? "1970-01-01" : periodStartIso(periodDays);

    const estadoActivo = await getEstadoIdByCodigo(admin, "activo");

    // Cabeceras: compras PDF se mantienen a nivel granja; raciones se pueden
    // segmentar por lote operativo.
    let cabQuery = admin
      .from("alimentaciones")
      .select("id, fecha, turno, costo_total, observaciones, lote_id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null);
    if (!allTime) {
      cabQuery = cabQuery.gte("fecha", desde);
    }

    let animalsQuery = admin
      .from("animales")
      .select("id", { count: "exact", head: true })
      .eq("granja_id", granjaId)
      .eq("estado_id", estadoActivo)
      .is("deleted_at", null);
    if (loteId) animalsQuery = animalsQuery.eq("lote_id", loteId);

    const [
      { count: activeHead },
      { data: alimentos, error: eAlimentos },
      { data: cabeceras, error: eCab },
    ] = await Promise.all([
      animalsQuery,
      admin
        .from("alimentos")
        .select("id, nombre, unidad_medida, costo_unitario")
        .eq("granja_id", granjaId)
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre", { ascending: true }),
      cabQuery,
    ]);

    if (eAlimentos) throw new Error(eAlimentos.message);
    if (eCab) throw new Error(eCab.message);

    type CabRowLote = CabRow & { lote_id?: string | null };

    // turno=compra → ingreso PDF/factura (granja, siempre visible).
    // Raciones → consumo del lote activo (partes iguales entre animales).
    const allCabs = (cabeceras ?? []) as CabRowLote[];
    const compraCabs = allCabs.filter((c) => c.turno === "compra");
    const racionCabs = allCabs.filter((c) => {
      if (c.turno === "compra") return false;
      if (!loteId) return true;
      return c.lote_id === loteId || c.lote_id == null;
    });

    type DetRow = {
      alimento_id: string;
      cantidad: number;
      subtotal: number;
      alimentacion_id: string;
    };

    const fetchDetalles = async (ids: string[]): Promise<DetRow[]> => {
      if (ids.length === 0) return [];
      const out: DetRow[] = [];
      const CHUNK = 80;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data, error: eDet } = await admin
          .from("detalle_alimentaciones")
          .select("alimento_id, cantidad, subtotal, alimentacion_id")
          .in("alimentacion_id", slice);
        if (eDet) throw new Error(eDet.message);
        out.push(...((data ?? []) as DetRow[]));
      }
      return out;
    };

    const sumDetalles = (rowsDet: DetRow[]) => {
      const map = new Map<string, ConsumoRow>();
      for (const row of rowsDet) {
        const aid = row.alimento_id;
        const cur = map.get(aid) ?? {
          alimento_id: aid,
          total_cantidad: 0,
          total_costo: 0,
        };
        cur.total_cantidad += Number(row.cantidad) || 0;
        cur.total_costo += Number(row.subtotal) || 0;
        map.set(aid, cur);
      }
      return map;
    };

    const racionIds = racionCabs.map((c) => c.id);
    const compraIds = compraCabs.map((c) => c.id);

    const detalleRacion = await fetchDetalles(racionIds);
    const detalleCompra = await fetchDetalles(compraIds);

    const heads = activeHead ?? 0;
    const rows = [...(alimentos ?? [])] as Record<string, unknown>[];

    const racionMap = sumDetalles(detalleRacion);

    const compraLinesByAlimento = new Map<string, DetRow[]>();
    for (const d of detalleCompra) {
      const list = compraLinesByAlimento.get(d.alimento_id) ?? [];
      list.push(d);
      compraLinesByAlimento.set(d.alimento_id, list);
    }

    /**
     * Precio / cantidad honestos:
     * - Si hay kg reales (qty>1 y ₡/u razonable, sin kilos inventados) → promedio ponderado ₡/unidad.
     * - Si no (factura sin kg, o qty=monto÷precio catálogo) → N compras y ₡ promedio/compra.
     */
    const analyzeCompras = (
      lines: DetRow[],
      catalogPrice: number,
      catalogUnit: string
    ) => {
      const totalCost = lines.reduce((s, l) => s + (Number(l.subtotal) || 0), 0);
      const purchaseCount = lines.length;
      if (purchaseCount === 0) {
        return {
          displayQty: 0,
          displayUnit: catalogUnit,
          pricePerUnit: 0,
          priceBasis: "none" as const,
          totalCost: 0,
          purchaseCount: 0,
        };
      }

      const analyzed = lines.map((l) => {
        const qty = Number(l.cantidad) || 0;
        const cost = Number(l.subtotal) || 0;
        const unitPrice = qty > 0 ? cost / qty : 0;
        return { qty, cost, unitPrice };
      });

      const totalQty = analyzed.reduce((s, a) => s + a.qty, 0);
      const avgUnit = totalQty > 0 ? totalCost / totalQty : 0;
      const unit = catalogUnit || "kg";
      // Solo “falta cantidad de masa” aplica a kg/sacos. ml/und/dosis no se solapan a kg.
      const expectsMasa = esUnidadMasa(unit);
      const allSingleLot =
        expectsMasa && analyzed.every((a) => a.qty > 0 && a.qty <= 1.0001);
      const hugeInventedKg =
        expectsMasa && analyzed.some((a) => a.qty > 100_000);
      const matchesCatalogSeed =
        expectsMasa &&
        catalogPrice > 0 &&
        catalogPrice <= 5_000 &&
        analyzed.every(
          (a) => a.qty > 1 && Math.abs(a.unitPrice - catalogPrice) < 0.05
        ) &&
        totalQty > 1_000;

      const useCompraBasis =
        expectsMasa && (allSingleLot || hugeInventedKg || matchesCatalogSeed);

      if (useCompraBasis) {
        return {
          displayQty: purchaseCount,
          displayUnit: "compra",
          pricePerUnit: Math.round((totalCost / purchaseCount) * 100) / 100,
          priceBasis: "compra" as const,
          totalCost,
          purchaseCount,
        };
      }

      return {
        displayQty: Math.round(totalQty * 1000) / 1000,
        displayUnit: labelUnidad(unit),
        pricePerUnit: Math.round(avgUnit * 10000) / 10000,
        priceBasis: "unit" as const,
        totalCost,
        purchaseCount,
      };
    };

    // Incluir insumos referidos en detalle aunque no estén en el catálogo activo.
    const knownIds = new Set(rows.map((r) => r.id as string));
    const missingIds = [...compraLinesByAlimento.keys(), ...racionMap.keys()].filter(
      (id) => !knownIds.has(id)
    );
    if (missingIds.length > 0) {
      const { data: extra } = await admin
        .from("alimentos")
        .select("id, nombre, unidad_medida, costo_unitario")
        .in("id", missingIds);
      for (const r of extra ?? []) {
        rows.push(r as Record<string, unknown>);
      }
    }

    const distinctDays = new Set(
      racionCabs.map((f: { fecha: string }) => f.fecha)
    ).size;
    const daysInPeriod = distinctDays > 0 ? distinctDays : periodDays;
    const animalDays = heads > 0 ? heads * daysInPeriod : 0;

    let totalDailyKg = 0;

    const feedTypes = rows.map((r: Record<string, unknown>) => {
      const id = r.id as string;
      const racion = racionMap.get(id);
      const lines = compraLinesByAlimento.get(id) ?? [];
      const catalogPrice = Number(r.costo_unitario) || 0;
      const catalogUnit = (r.unidad_medida as string) || "kg";
      const compraStats = analyzeCompras(lines, catalogPrice, catalogUnit);

      const racionQty = racion?.total_cantidad ?? 0;
      const racionCost = racion?.total_costo ?? 0;

      const periodQty =
        compraStats.purchaseCount > 0
          ? compraStats.displayQty + (racionQty > 0 ? racionQty : 0)
          : racionQty;
      const periodCost = compraStats.totalCost + racionCost;
      const unit =
        compraStats.purchaseCount > 0
          ? compraStats.displayUnit
          : catalogUnit;

      let pricePerUnit = compraStats.pricePerUnit;
      let priceBasis = compraStats.priceBasis;
      if (compraStats.purchaseCount === 0) {
        pricePerUnit =
          catalogPrice > 0 && catalogPrice <= 5_000 ? catalogPrice : 0;
        priceBasis = pricePerUnit > 0 ? "unit" : "none";
      }

      // Raciones reales; si no hay, se completa abajo con sugerencia PDF equitativa.
      const dailyConsumption =
        racionQty > 0 && animalDays > 0
          ? Math.round((racionQty / animalDays) * 100) / 100
          : 0;

      totalDailyKg += dailyConsumption;

      return {
        id,
        name: r.nombre as string,
        unit,
        dailyConsumption,
        pricePerUnit,
        priceBasis,
        purchaseCount: compraStats.purchaseCount,
        monthlyAmount: Math.round(periodQty * 1000) / 1000,
        monthlyCost: Math.round(periodCost * 100) / 100,
        percentage: 0,
      };
    });

    // % por costo del período (compras o raciones), no solo por kg/día.
    const sumPeriodCost = feedTypes.reduce((s, f) => s + f.monthlyCost, 0);
    const sumDaily = feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);
    for (const f of feedTypes) {
      if (sumDaily > 0) {
        f.percentage =
          Math.round((f.dailyConsumption / sumDaily) * 1000) / 10;
      } else if (sumPeriodCost > 0) {
        f.percentage = Math.round((f.monthlyCost / sumPeriodCost) * 1000) / 10;
      } else {
        f.percentage = 0;
      }
    }

    // Compras ALIM: gastos contabilizados + sync turno=compra (solo costo, no kg/día).
    const { data: catAlim } = await admin
      .from("categorias_gastos")
      .select("id")
      .eq("codigo", "ALIM")
      .maybeSingle();

    let purchaseCostPeriod = 0;
    let purchaseCount = 0;
    if (catAlim?.id) {
      let gastosQuery = admin
        .from("gastos")
        .select("monto")
        .eq("granja_id", granjaId)
        .eq("categoria_id", catAlim.id)
        .is("deleted_at", null);
      if (!allTime) {
        gastosQuery = gastosQuery.gte("fecha", desde);
      }
      const { data: gastosAlim } = await gastosQuery;
      purchaseCount = gastosAlim?.length ?? 0;
      purchaseCostPeriod = (gastosAlim ?? []).reduce(
        (s, g) => s + Number(g.monto),
        0
      );
    }
    if (compraCabs.length > 0 && purchaseCostPeriod <= 0) {
      purchaseCount = compraCabs.length;
      purchaseCostPeriod = compraCabs.reduce(
        (s, c) => s + Number(c.costo_total),
        0
      );
    }

    const alimentoMeta = new Map(
      rows.map((r) => [
        r.id as string,
        {
          nombre: r.nombre as string,
          unidad: ((r.unidad_medida as string) || "kg") as string,
        },
      ])
    );
    const cabById = new Map(compraCabs.map((c) => [c.id, c]));

    const purchaseHistory: PurchaseHistoryItem[] = detalleCompra
      .map((d) => {
        const cab = cabById.get(d.alimentacion_id);
        const meta = alimentoMeta.get(d.alimento_id);
        const rawQty = Number(d.cantidad) || 0;
        const costo = Math.round((Number(d.subtotal) || 0) * 100) / 100;
        const catalogUnit = meta?.unidad ?? "kg";
        // Solo marcar “sin cantidad” en productos de masa (kg). Vet/ml/und no aplican.
        const asCompra =
          esUnidadMasa(catalogUnit) &&
          (rawQty <= 1.0001 || rawQty > 100_000);
        return {
          id: `${d.alimentacion_id}:${d.alimento_id}`,
          alimentacionId: d.alimentacion_id,
          fecha: cab?.fecha ?? "",
          alimentoId: d.alimento_id,
          alimentoNombre: meta?.nombre ?? "Insumo",
          cantidad: asCompra
            ? 1
            : Math.round(rawQty * 1000) / 1000,
          unidad: asCompra ? "compra" : labelUnidad(catalogUnit),
          costo,
          origen: origenDesdeObservaciones(cab?.observaciones),
        };
      })
      .filter((p) => p.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.alimentoNombre.localeCompare(b.alimentoNombre));

    // Serie para gráfico: costo por fecha de compra (apilado por producto).
    const productNames = [
      ...new Set(purchaseHistory.map((p) => p.alimentoNombre)),
    ].sort((a, b) => a.localeCompare(b));
    const byFecha = new Map<string, Record<string, number>>();
    for (const p of purchaseHistory) {
      const row = byFecha.get(p.fecha) ?? { total: 0 };
      row[p.alimentoNombre] = (Number(row[p.alimentoNombre]) || 0) + p.costo;
      row.total = (Number(row.total) || 0) + p.costo;
      byFecha.set(p.fecha, row);
    }
    const costByPurchaseDate = [...byFecha.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => {
        const point: Record<string, string | number> = {
          fecha,
          label: formatFechaCorta(fecha),
          total: Math.round(Number(vals.total) * 100) / 100,
        };
        for (const name of productNames) {
          point[name] = Math.round((Number(vals[name]) || 0) * 100) / 100;
        }
        return point;
      });

    // Historial de entregas (raciones, no compras).
    const detRacionFull = await fetchDetalles(racionIds);
    const linesByEntrega = new Map<
      string,
      { alimentoId: string; nombre: string; cantidad: number; subtotal: number }[]
    >();
    for (const d of detRacionFull) {
      const meta = alimentoMeta.get(d.alimento_id);
      const list = linesByEntrega.get(d.alimentacion_id) ?? [];
      list.push({
        alimentoId: d.alimento_id,
        nombre: meta?.nombre ?? "Insumo",
        cantidad: Math.round((Number(d.cantidad) || 0) * 1000) / 1000,
        subtotal: Math.round((Number(d.subtotal) || 0) * 100) / 100,
      });
      linesByEntrega.set(d.alimentacion_id, list);
    }
    const deliveryHistory = racionCabs
      .map((c) => ({
        id: c.id,
        fecha: c.fecha,
        costoTotal: Math.round(Number(c.costo_total) * 100) / 100,
        observaciones: c.observaciones ?? null,
        lineas: linesByEntrega.get(c.id) ?? [],
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const lastDelivery =
      deliveryHistory.length > 0
        ? {
            fecha: deliveryHistory[0].fecha,
            lines: deliveryHistory[0].lineas.map((l) => ({
              alimentoId: l.alimentoId,
              cantidad: l.cantidad,
            })),
          }
        : null;

    // Stock estimado: entradas kg reales − salidas por ración.
    // Incluye TODOS los alimentos con movimiento PDF aunque no haya raciones.
    const stockByAlimento = rows.map((r) => {
      const id = r.id as string;
      const nombre = r.nombre as string;
      const lines = compraLinesByAlimento.get(id) ?? [];
      const catalogUnit =
        (alimentoMeta.get(id)?.unidad as string | undefined) ?? "kg";
      let entradasKg = 0;
      let entradasCompras = 0;
      let costoCompras = 0;
      for (const l of lines) {
        const qty = Number(l.cantidad) || 0;
        const cost = Number(l.subtotal) || 0;
        costoCompras += cost;
        const asCompra =
          esUnidadMasa(catalogUnit) && (qty <= 1.0001 || qty > 100_000);
        if (!asCompra && esUnidadMasa(catalogUnit)) entradasKg += qty;
        else if (asCompra) entradasCompras += 1;
      }
      const salidasKg = racionMap.get(id)?.total_cantidad ?? 0;
      const stockKg = Math.round((entradasKg - salidasKg) * 1000) / 1000;
      const daily = feedTypes.find((f) => f.id === id)?.dailyConsumption ?? 0;
      const herdDaily = daily * heads;
      const diasCobertura =
        herdDaily > 0 && stockKg > 0
          ? Math.round((stockKg / herdDaily) * 10) / 10
          : null;
      return {
        alimentoId: id,
        nombre,
        entradasKg: Math.round(entradasKg * 1000) / 1000,
        salidasKg: Math.round(salidasKg * 1000) / 1000,
        stockKg,
        entradasComprasSinKg: entradasCompras,
        diasCobertura,
        costoCompras: Math.round(costoCompras * 100) / 100,
        desdePdf: lines.length > 0,
      };
    });

    /**
     * Porciones equitativas entre animales del lote:
     * - Si hay raciones: kg entregados ÷ cabezas (y ÷ días con registro).
     * - Si solo hay compras PDF con kg: sugerencia = kg comprados ÷ cabezas ÷ días del período.
     * Los alimentos PDF siempre aparecen aunque aún no haya entregas.
     */
    const daysForSuggest = distinctDays > 0 ? distinctDays : Math.max(periodDays, 1);
    const porcionesEquitativas = stockByAlimento
      .filter(
        (s) =>
          s.entradasKg > 0 ||
          s.salidasKg > 0 ||
          s.entradasComprasSinKg > 0 ||
          s.desdePdf
      )
      .map((s) => {
        const hasRacion = s.salidasKg > 0;
        const baseKg = hasRacion ? s.salidasKg : s.entradasKg;
        const daysBase = hasRacion ? Math.max(distinctDays, 1) : daysForSuggest;
        const kgPorAnimal =
          heads > 0 && baseKg > 0
            ? Math.round((baseKg / heads) * 1000) / 1000
            : 0;
        const kgPorAnimalDia =
          heads > 0 && baseKg > 0
            ? Math.round((baseKg / heads / daysBase) * 1000) / 1000
            : 0;
        const kgHatoDia =
          heads > 0 && kgPorAnimalDia > 0
            ? Math.round(kgPorAnimalDia * heads * 1000) / 1000
            : 0;
        return {
          alimentoId: s.alimentoId,
          nombre: s.nombre,
          origen: hasRacion
            ? ("racion" as const)
            : s.entradasKg > 0
              ? ("pdf_sugerido" as const)
              : ("pdf_sin_kg" as const),
          totalKg: Math.round(baseKg * 1000) / 1000,
          animalCount: heads,
          kgPorAnimal,
          kgPorAnimalDia,
          kgHatoDia,
          stockKg: s.stockKg,
          comprasSinKg: s.entradasComprasSinKg,
          costoCompras: s.costoCompras,
        };
      })
      .sort((a, b) => {
        // Primero con kg útiles, luego alfabético
        const score = (x: typeof a) =>
          x.origen === "racion" ? 0 : x.origen === "pdf_sugerido" ? 1 : 2;
        const d = score(a) - score(b);
        if (d !== 0) return d;
        return a.nombre.localeCompare(b.nombre);
      });

    const purchasesWithKg = purchaseHistory.filter((p) => p.unidad !== "compra");
    const purchasesWithoutKg = purchaseHistory.filter((p) => p.unidad === "compra");
    const kgTotalComprado = purchasesWithKg.reduce((s, p) => s + p.cantidad, 0);
    const costWithKg = purchasesWithKg.reduce((s, p) => s + p.costo, 0);
    const avgCostPerKg =
      kgTotalComprado > 0
        ? Math.round((costWithKg / kgTotalComprado) * 100) / 100
        : 0;
    const avgCostPerPurchase =
      purchaseHistory.length > 0
        ? Math.round(
            (purchaseHistory.reduce((s, p) => s + p.costo, 0) /
              purchaseHistory.length) *
              100
          ) / 100
        : 0;

    const coveragePercent = allTime
      ? null
      : Math.round(
          (distinctDays / Math.max(periodDays, 1)) * 1000
        ) / 10;

    // Período anterior (mismo largo) para comparación.
    let previousPurchaseCost = 0;
    const previousCostByAlimento: { name: string; costo: number }[] = [];
    if (!allTime) {
      const prevEnd = new Date(desde + "T00:00:00Z");
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setUTCDate(prevStart.getUTCDate() - (periodDays - 1));
      const prevDesde = prevStart.toISOString().slice(0, 10);
      const prevHasta = prevEnd.toISOString().slice(0, 10);
      const { data: prevCabs } = await admin
        .from("alimentaciones")
        .select("id, costo_total")
        .eq("granja_id", granjaId)
        .eq("turno", "compra")
        .is("deleted_at", null)
        .gte("fecha", prevDesde)
        .lte("fecha", prevHasta);
      previousPurchaseCost = Math.round(
        (prevCabs ?? []).reduce((s, c) => s + Number(c.costo_total), 0) * 100
      ) / 100;
      const prevIds = (prevCabs ?? []).map((c) => c.id);
      if (prevIds.length > 0) {
        const prevDet = await fetchDetalles(prevIds);
        const map = new Map<string, number>();
        for (const d of prevDet) {
          const name = alimentoMeta.get(d.alimento_id)?.nombre ?? "Insumo";
          map.set(name, (map.get(name) ?? 0) + Number(d.subtotal));
        }
        for (const [name, costo] of map) {
          previousCostByAlimento.push({
            name,
            costo: Math.round(costo * 100) / 100,
          });
        }
        previousCostByAlimento.sort((a, b) => b.costo - a.costo);
      }
    }

    // Alertas accionables.
    type Alert = {
      id: string;
      tone: "warning" | "danger" | "info";
      title: string;
      message: string;
      href?: string;
    };
    const alerts: Alert[] = [];
    if (purchasesWithoutKg.length > 0) {
      alerts.push({
        id: "sin-kg",
        tone: "warning",
        title: `${purchasesWithoutKg.length} compra(s) de alimento sin kg`,
        message:
          "Solo aplica a melaza/concentrado/maíz (masa). Productos vet (ml/dosis) van en Salud, no se convierten a kg. Completa kg en Compras o al confirmar el PDF de alimento.",
        href: "/feeding?modo=compras",
      });
    }
    if (!allTime && distinctDays === 0 && purchaseCount > 0) {
      alerts.push({
        id: "sin-entregas",
        tone: "warning",
        title: "Sin raciones en el período",
        message:
          "Hay compras registradas pero ninguna entrega diaria. Registra la ración de hoy.",
        href: "/feeding?modo=raciones",
      });
    } else if (!allTime && distinctDays > 0) {
      const weekStart = periodStartIso(7);
      const daysLastWeek = new Set(
        racionCabs
          .filter((c) => c.fecha >= weekStart)
          .map((c) => c.fecha)
      ).size;
      if (daysLastWeek < 3) {
        alerts.push({
          id: "baja-cobertura",
          tone: "info",
          title: "Pocas entregas esta semana",
          message: `Solo ${daysLastWeek} día(s) con ración en los últimos 7 días.`,
          href: "/feeding?modo=raciones",
        });
      }
    }
    for (const s of stockByAlimento) {
      if (
        s.diasCobertura != null &&
        s.diasCobertura < 7 &&
        s.entradasKg > 0
      ) {
        alerts.push({
          id: `stock-${s.alimentoId}`,
          tone: "danger",
          title: `Stock bajo: ${s.nombre}`,
          message: `Quedan ~${s.diasCobertura} día(s) de consumo al ritmo actual (${s.stockKg} kg).`,
          href: "/feeding?modo=resumen",
        });
      }
    }
    // Solo insumos sin movimiento en todo el histórico (no por período).
    const idleInPeriod = feedTypes.filter(
      (f) => f.monthlyCost <= 0 && f.dailyConsumption <= 0
    );
    let orphans = idleInPeriod;
    if (!allTime && idleInPeriod.length > 0) {
      const candidateIds = idleInPeriod.map((f) => f.id);
      const { data: everRows, error: eEver } = await admin
        .from("detalle_alimentaciones")
        .select("alimento_id, alimentaciones!inner(granja_id, deleted_at)")
        .in("alimento_id", candidateIds)
        .eq("alimentaciones.granja_id", granjaId)
        .is("alimentaciones.deleted_at", null);
      if (eEver) throw new Error(eEver.message);
      const usedEver = new Set(
        (everRows ?? []).map((r) => r.alimento_id as string)
      );
      orphans = idleInPeriod.filter((f) => !usedEver.has(f.id));
    }
    if (orphans.length > 0) {
      alerts.push({
        id: "huerfanos",
        tone: "info",
        title: `${orphans.length} insumo(s) sin movimiento`,
        message:
          "Están en catálogo pero nunca han tenido compras ni raciones.",
        href: "/gestion/alimentacion",
      });
    }

    let lotes: { id: string; nombre: string }[] = [];
    try {
      lotes = await listOpenLotes(admin, granjaId);
    } catch {
      lotes = [];
    }
    const racionCostPeriod = Math.round(
      detalleRacion.reduce((s, d) => s + (Number(d.subtotal) || 0), 0) * 100
    ) / 100;
    const costPerAnimalDayRacion =
      heads > 0 && distinctDays > 0
        ? Math.round((racionCostPeriod / heads / distinctDays) * 100) / 100
        : 0;

    // Completar feedTypes sin ración con sugerencia equitativa desde PDF.
    if (totalDailyKg <= 0 && heads > 0) {
      const suggestDays = Math.max(periodDays, 1);
      for (const f of feedTypes) {
        const stock = stockByAlimento.find((s) => s.alimentoId === f.id);
        if (!stock || stock.entradasKg <= 0) continue;
        f.dailyConsumption =
          Math.round((stock.entradasKg / heads / suggestDays) * 1000) / 1000;
        totalDailyKg += f.dailyConsumption;
      }
      const sumDailySuggest = feedTypes.reduce(
        (s, f) => s + f.dailyConsumption,
        0
      );
      if (sumDailySuggest > 0) {
        for (const f of feedTypes) {
          f.percentage =
            Math.round((f.dailyConsumption / sumDailySuggest) * 1000) / 10;
        }
      }
    }

    // Si no hay raciones pero sí compras PDF con kg, el KPI kg/animal/día
    // usa la sugerencia equitativa para no dejar el resumen vacío.
    const suggestedDailyTotal = porcionesEquitativas
      .filter((p) => p.origen === "pdf_sugerido")
      .reduce((s, p) => s + p.kgPorAnimalDia, 0);
    const effectiveDailyConsumption =
      totalDailyKg > 0
        ? Math.round(totalDailyKg * 100) / 100
        : Math.round(suggestedDailyTotal * 100) / 100;

    return jsonOk({
      activeHeadCount: heads,
      periodDays,
      daysWithRecords: distinctDays,
      hasConsumptionRecords: detalleRacion.length > 0,
      feedTypes,
      totalDailyConsumption: effectiveDailyConsumption,
      purchaseCount,
      purchaseCostPeriod: Math.round(purchaseCostPeriod * 100) / 100,
      periodFrom: allTime ? null : desde,
      allTime,
      purchaseHistory,
      costByPurchaseDate,
      purchaseProductNames: productNames,
      deliveryHistory,
      lastDelivery,
      stockByAlimento,
      porcionesEquitativas,
      purchasesWithKgCount: purchasesWithKg.length,
      purchasesWithoutKgCount: purchasesWithoutKg.length,
      avgCostPerKg,
      avgCostPerPurchase,
      coveragePercent,
      previousPurchaseCost,
      previousCostByAlimento,
      alerts,
      lotes,
      racionCostPeriod,
      costPerAnimalDayRacion,
      loteId,
      /** Compras PDF se conservan a nivel granja aunque el lote filtre raciones. */
      comprasCompartidasGranja: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostLine = {
  alimentoId?: string;
  cantidad?: number;
};

type PostBody = {
  fecha?: string;
  observaciones?: string;
  loteId?: string;
  lines?: PostLine[];
};

/** Registra una entrega/ración (cabecera + detalle). */
export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const body = (await req.json()) as PostBody;

    const fecha = (body.fecha ?? new Date().toISOString().slice(0, 10)).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return jsonError("fecha inválida (YYYY-MM-DD).");
    }

    const lines = (body.lines ?? []).filter(
      (l) => l.alimentoId && l.cantidad != null && Number(l.cantidad) > 0
    );
    if (lines.length === 0) {
      return jsonError("Indique al menos un insumo con cantidad > 0.");
    }

    const alimentoIds = [...new Set(lines.map((l) => l.alimentoId!))];
    const { data: alimentosRows, error: eAlim } = await admin
      .from("alimentos")
      .select("id, nombre, costo_unitario")
      .eq("granja_id", granjaId)
      .in("id", alimentoIds)
      .is("deleted_at", null);
    if (eAlim) throw new Error(eAlim.message);

    const precioById = new Map(
      (alimentosRows ?? []).map((a: { id: string; costo_unitario: number; nombre: string }) => [
        a.id,
        { precio: Number(a.costo_unitario), nombre: a.nombre },
      ])
    );

    for (const id of alimentoIds) {
      if (!precioById.has(id)) {
        return jsonError(`Alimento ${id} no encontrado en el catálogo.`, 400);
      }
    }

    const detallePayload = lines.map((l) => {
      const meta = precioById.get(l.alimentoId!)!;
      const cantidad = Number(l.cantidad);
      const costo_unitario = meta.precio;
      const subtotal = Math.round(cantidad * costo_unitario * 100) / 100;
      return {
        alimento_id: l.alimentoId!,
        cantidad,
        costo_unitario,
        subtotal,
        nombre: meta.nombre,
      };
    });

    const costoTotal =
      Math.round(detallePayload.reduce((s, d) => s + d.subtotal, 0) * 100) /
      100;

    let loteId = body.loteId?.trim() || null;
    if (loteId) {
      const { data: loteOk } = await admin
        .from("lotes")
        .select("id")
        .eq("id", loteId)
        .eq("granja_id", granjaId)
        .eq("estado", "abierto")
        .is("deleted_at", null)
        .maybeSingle();
      if (!loteOk) return jsonError("Lote no válido o cerrado.", 400);
    } else {
      loteId = await getDefaultLoteId(admin, granjaId);
    }
    if (!loteId) {
      return jsonError(
        "No hay lote abierto. Cree un lote antes de registrar alimentación.",
        400
      );
    }

    const { data: cabecera, error: eCab } = await admin
      .from("alimentaciones")
      .insert({
        granja_id: granjaId,
        lote_id: loteId,
        fecha,
        turno: "racion",
        costo_total: costoTotal,
        observaciones: body.observaciones?.trim() || null,
        created_by: usuario.id,
        updated_by: usuario.id,
      })
      .select("id, fecha, costo_total")
      .single();
    if (eCab) return jsonError(eCab.message, 400);

    const { error: eDet } = await admin.from("detalle_alimentaciones").insert(
      detallePayload.map((d) => ({
        alimentacion_id: cabecera.id,
        alimento_id: d.alimento_id,
        cantidad: d.cantidad,
        costo_unitario: d.costo_unitario,
        subtotal: d.subtotal,
      }))
    );

    if (eDet) {
      await admin.from("alimentaciones").delete().eq("id", cabecera.id);
      return jsonError(eDet.message, 400);
    }

    const resumenLineas = detallePayload
      .map((d) => `${d.nombre}: ${d.cantidad}`)
      .join(", ");

    await registrarHistorial(admin, {
      granjaId,
      modulo: "alimentacion",
      registroId: cabecera.id,
      referencia: `Entrega ${fecha}`,
      accion: "crear",
      resumen: `Entrega de alimentación ${fecha} — ₡${costoTotal}. ${resumenLineas}`,
      datosNuevos: {
        fecha,
        costo_total: costoTotal,
        lineas: detallePayload.map(({ alimento_id, cantidad, subtotal }) => ({
          alimento_id,
          cantidad,
          subtotal,
        })),
      },
      usuarioId: usuario.id,
    });

    return jsonOk(
      {
        id: cabecera.id,
        fecha: cabecera.fecha,
        costoTotal: Number(cabecera.costo_total),
        lineCount: detallePayload.length,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

/** Anula (soft-delete) una entrega/ración. Body: { id } */
export async function DELETE(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const body = (await req.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) return jsonError("id obligatorio.");

    const { data: cab, error: eCab } = await admin
      .from("alimentaciones")
      .select("id, fecha, turno, costo_total")
      .eq("id", id)
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eCab) return jsonError(eCab.message, 500);
    if (!cab) return jsonError("Entrega no encontrada.", 404);
    if (cab.turno === "compra") {
      return jsonError("No se pueden anular compras PDF desde aquí.", 400);
    }

    const { error: eUp } = await admin
      .from("alimentaciones")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: usuario.id,
      })
      .eq("id", id);
    if (eUp) return jsonError(eUp.message, 400);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "alimentacion",
      registroId: id,
      referencia: `Entrega ${cab.fecha}`,
      accion: "eliminar",
      resumen: `Anulación de entrega ${cab.fecha} — ₡${cab.costo_total}`,
      usuarioId: usuario.id,
    });

    return jsonOk({ id, deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
