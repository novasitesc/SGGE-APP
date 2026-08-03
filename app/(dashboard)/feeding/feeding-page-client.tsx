"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  deleteFeedingDeliveryApi,
  fetchFeeding,
  updateCompraCantidadApi,
  type FeedingPeriodDays,
  type FeedPurchaseHistoryItem,
} from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Wheat,
  Scale,
  DollarSign,
  Gauge,
  Plus,
  FileText,
  Download,
  AlertTriangle,
  Package,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";
import { RegistrarEntregaDialog } from "@/components/feeding/RegistrarEntregaDialog";
import {
  PERIOD_OPTIONS,
  PURCHASE_BAR_COLORS,
  buildCostByAlimento,
  buildCostByDate,
  downloadCsv,
  filterFeedTypes,
  formatFechaLarga,
  parseModeParam,
  type FeedingMode,
} from "@/components/feeding/feeding-utils";

const PAGE_SIZE = 20;

export default function FeedingPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<FeedingMode>(() =>
    parseModeParam(searchParams.get("modo"))
  );
  // Compras: histórico completo. Resumen/Raciones: últimos 30 días.
  const [periodFilter, setPeriodFilter] = useState<FeedingPeriodDays>(() =>
    parseModeParam(searchParams.get("modo")) === "compras" ? "all" : 30
  );
  const [alimentoFilter, setAlimentoFilter] = useState(
    () => searchParams.get("alimento") ?? "all"
  );
  const [chartView, setChartView] = useState<"fecha" | "alimento">("fecha");
  const [showInactive, setShowInactive] = useState(false);
  const [comparePrev, setComparePrev] = useState(false);
  const [entregaOpen, setEntregaOpen] = useState(false);
  const [duplicateLines, setDuplicateLines] = useState<
    { alimentoId: string; cantidad: number }[] | null
  >(null);
  const [searchHist, setSearchHist] = useState("");
  const [pageCompras, setPageCompras] = useState(0);
  const [pageEntregas, setPageEntregas] = useState(0);
  const [qtyEditId, setQtyEditId] = useState<string | null>(null);
  const [qtyEditValue, setQtyEditValue] = useState("");
  const [qtySaving, setQtySaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: feeding, loading, error, reload } = useApiQuery(
    () => fetchFeeding(periodFilter),
    [periodFilter]
  );

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("modo", mode);
    params.set("days", String(periodFilter));
    if (alimentoFilter !== "all") params.set("alimento", alimentoFilter);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [mode, periodFilter, alimentoFilter, pathname, router]);

  const feedTypes = feeding?.feedTypes ?? [];
  const animalCount = feeding?.activeHeadCount ?? 0;
  const hasConsumption = feeding?.hasConsumptionRecords ?? false;
  const daysWithRecords = feeding?.daysWithRecords ?? 0;
  const periodDays =
    feeding?.periodDays ?? (periodFilter === "all" ? 30 : periodFilter);
  const periodFrom = feeding?.periodFrom;
  const allTime = feeding?.allTime ?? periodFilter === "all";
  const purchaseCost = feeding?.purchaseCostPeriod ?? 0;
  const purchaseCount = feeding?.purchaseCount ?? 0;
  const purchaseHistory = feeding?.purchaseHistory ?? [];
  const deliveryHistory = feeding?.deliveryHistory ?? [];
  const stockByAlimento = feeding?.stockByAlimento ?? [];
  const alerts = feeding?.alerts ?? [];
  const lotes = feeding?.lotes ?? [];
  const lastDelivery = feeding?.lastDelivery ?? null;
  const previousPurchaseCost = feeding?.previousPurchaseCost ?? 0;
  const previousCostByAlimento = feeding?.previousCostByAlimento ?? [];
  const avgCostPerKg = feeding?.avgCostPerKg ?? 0;
  const avgCostPerPurchase = feeding?.avgCostPerPurchase ?? 0;
  const purchasesWithKgCount = feeding?.purchasesWithKgCount ?? 0;
  const purchasesWithoutKgCount = feeding?.purchasesWithoutKgCount ?? 0;
  const coveragePercent = feeding?.coveragePercent;
  const racionCostPeriod = feeding?.racionCostPeriod ?? 0;
  const costPerAnimalDayRacion = feeding?.costPerAnimalDayRacion ?? 0;
  const totalDailyConsumption = feeding?.totalDailyConsumption ?? 0;

  const periodLabel = allTime
    ? "todo el histórico"
    : `últimos ${periodDays} días`;

  const alimentoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of feedTypes) map.set(f.id, f.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [feedTypes]);

  const filteredHistory = useMemo(() => {
    let rows = purchaseHistory;
    if (alimentoFilter !== "all") {
      rows = rows.filter((p) => p.alimentoId === alimentoFilter);
    }
    if (searchHist.trim()) {
      const q = searchHist.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.alimentoNombre.toLowerCase().includes(q) ||
          p.origen.toLowerCase().includes(q) ||
          p.fecha.includes(q)
      );
    }
    return rows;
  }, [purchaseHistory, alimentoFilter, searchHist]);

  const filteredDeliveries = useMemo(() => {
    let rows = deliveryHistory;
    if (alimentoFilter !== "all") {
      rows = rows.filter((d) =>
        d.lineas.some((l) => l.alimentoId === alimentoFilter)
      );
    }
    if (searchHist.trim()) {
      const q = searchHist.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          d.fecha.includes(q) ||
          (d.observaciones ?? "").toLowerCase().includes(q) ||
          d.lineas.some((l) => l.nombre.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [deliveryHistory, alimentoFilter, searchHist]);

  const filteredFeedTypes = useMemo(
    () => filterFeedTypes(feedTypes, alimentoFilter, showInactive),
    [feedTypes, alimentoFilter, showInactive]
  );

  const filteredPurchaseCost = useMemo(
    () => filteredHistory.reduce((s, r) => s + r.costo, 0),
    [filteredHistory]
  );

  const { points: costByPurchaseDate, names: purchaseProductNames } = useMemo(
    () => buildCostByDate(filteredHistory),
    [filteredHistory]
  );
  const costByAlimento = useMemo(
    () => buildCostByAlimento(filteredHistory),
    [filteredHistory]
  );

  const compareChartData = useMemo(() => {
    if (!comparePrev) return costByAlimento;
    const prevMap = new Map(
      previousCostByAlimento.map((p) => [p.name, p.costo])
    );
    const names = new Set([
      ...costByAlimento.map((c) => c.name),
      ...previousCostByAlimento.map((p) => p.name),
    ]);
    return [...names].map((name) => ({
      name,
      costo: costByAlimento.find((c) => c.name === name)?.costo ?? 0,
      anterior: prevMap.get(name) ?? 0,
    }));
  }, [comparePrev, costByAlimento, previousCostByAlimento]);

  const pagedCompras = filteredHistory
    .slice()
    .reverse()
    .slice(pageCompras * PAGE_SIZE, (pageCompras + 1) * PAGE_SIZE);
  const pagedEntregas = filteredDeliveries.slice(
    pageEntregas * PAGE_SIZE,
    (pageEntregas + 1) * PAGE_SIZE
  );

  const setModeAndReset = (m: FeedingMode) => {
    setMode(m);
    setPeriodFilter(m === "compras" ? "all" : 30);
    setPageCompras(0);
    setPageEntregas(0);
    setSearchHist("");
  };

  const exportCompras = useCallback(() => {
    downloadCsv(
      `compras-alim-${periodFilter}.csv`,
      ["Fecha", "Producto", "Cantidad", "Unidad", "Costo", "Origen"],
      filteredHistory.map((r) => [
        r.fecha,
        r.alimentoNombre,
        String(r.cantidad),
        r.unidad,
        String(r.costo),
        r.origen,
      ])
    );
  }, [filteredHistory, periodFilter]);

  const exportEntregas = useCallback(() => {
    const rows: string[][] = [];
    for (const d of filteredDeliveries) {
      for (const l of d.lineas) {
        rows.push([
          d.fecha,
          l.nombre,
          String(l.cantidad),
          String(l.subtotal),
          d.observaciones ?? "",
        ]);
      }
    }
    downloadCsv(
      `entregas-alim-${periodFilter}.csv`,
      ["Fecha", "Producto", "Cantidad", "Subtotal", "Observaciones"],
      rows
    );
  }, [filteredDeliveries, periodFilter]);

  const saveQty = async (row: FeedPurchaseHistoryItem) => {
    const alimentacionId = row.alimentacionId ?? row.id.split(":")[0];
    const q = Number(qtyEditValue);
    if (!Number.isFinite(q) || q <= 0) {
      setActionError("Cantidad inválida.");
      return;
    }
    setQtySaving(true);
    setActionError(null);
    try {
      await updateCompraCantidadApi({
        alimentacionId,
        alimentoId: row.alimentoId,
        cantidad: q,
      });
      setQtyEditId(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al guardar kg");
    } finally {
      setQtySaving(false);
    }
  };

  const tabs: { id: FeedingMode; label: string; icon: typeof Package }[] = [
    { id: "resumen", label: "Resumen", icon: LayoutDashboard },
    { id: "compras", label: "Compras", icon: Package },
    { id: "raciones", label: "Raciones", icon: ClipboardList },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alimentación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compras, raciones y costos · {periodLabel}
            {periodFrom ? ` (desde ${periodFrom})` : ""}
            {animalCount > 0 ? ` · ${animalCount} animales activos` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gestion/comprobantes"
            className="text-sm px-3 py-2 rounded-xl border hover:bg-muted"
          >
            Comprobantes
          </Link>
          <Link
            href="/gestion/alimentacion"
            className="text-sm px-3 py-2 rounded-xl border hover:bg-muted"
          >
            Catálogo
          </Link>
          {feedTypes.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDuplicateLines(null);
                setEntregaOpen(true);
              }}
              className="flex items-center gap-2 shrink-0 bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Registrar entrega
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setModeAndReset(t.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600 text-white"
                  : "hover:bg-muted text-muted-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Período</p>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    setPeriodFilter(opt.value);
                    setPageCompras(0);
                    setPageEntregas(0);
                  }}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    periodFilter === opt.value
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-background hover:bg-muted border-border",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 w-full lg:w-52">
            <p className="text-xs font-medium text-muted-foreground">Alimento</p>
            <Select
              value={alimentoFilter}
              onChange={(e) => {
                setAlimentoFilter(e.target.value);
                setPageCompras(0);
                setPageEntregas(0);
              }}
            >
              <option value="all">Todos</option>
              {alimentoOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border"
            />
            Sin actividad
          </label>
          {(mode === "compras" || mode === "resumen") && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
              <input
                type="checkbox"
                checked={comparePrev}
                onChange={(e) => setComparePrev(e.target.checked)}
                className="rounded border"
                disabled={allTime}
              />
              vs período anterior
            </label>
          )}
        </CardContent>
      </Card>

      <RegistrarEntregaDialog
        open={entregaOpen}
        onOpenChange={(o) => {
          setEntregaOpen(o);
          if (!o) setDuplicateLines(null);
        }}
        feedTypes={feedTypes}
        animalCount={animalCount}
        lotes={lotes}
        lastDelivery={lastDelivery}
        duplicateLines={duplicateLines}
        onSuccess={() => void reload()}
      />

      {(error || actionError) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error || actionError}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 h-20 animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : feedTypes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wheat className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No hay insumos registrados.</p>
            <p className="text-sm mt-1">
              Agrega alimentos desde{" "}
              <Link href="/gestion/alimentacion" className="underline">
                Gestión → Alimentación
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Alertas unificadas (checklist + avisos) */}
          {(alerts.length > 0 ||
            (!hasConsumption && purchaseCount > 0) ||
            purchasesWithoutKgCount > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Alertas
                </CardTitle>
                <CardDescription>
                  Pendientes para completar costos, stock y raciones · {periodLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {purchasesWithoutKgCount > 0 && (
                  <div className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-950 px-4 py-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {purchasesWithoutKgCount} compra(s) sin kg
                      </p>
                      <p className="text-xs mt-0.5 opacity-90">
                        Sin cantidad en kg no se calcula ₡/kg ni stock. Edita kg
                        en Compras o al confirmar el PDF.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      <button
                        type="button"
                        className="text-xs font-medium underline"
                        onClick={() => setModeAndReset("compras")}
                      >
                        Editar kg
                      </button>
                      <Link
                        href="/gestion/comprobantes"
                        className="text-xs font-medium underline opacity-80"
                      >
                        Comprobantes
                      </Link>
                    </div>
                  </div>
                )}

                {!hasConsumption && (
                  <div className="text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-950 px-4 py-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Sin raciones en el período</p>
                      <p className="text-xs mt-0.5 opacity-90">
                        {purchaseCount > 0
                          ? "Hay compras registradas pero ninguna entrega diaria. Registra la ración de hoy."
                          : "Aún no hay entregas. Registra la ración de hoy para ver kg/animal."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium underline shrink-0"
                      onClick={() => {
                        setModeAndReset("raciones");
                        setDuplicateLines(null);
                        setEntregaOpen(true);
                      }}
                    >
                      Registrar
                    </button>
                  </div>
                )}

                {alerts
                  .filter(
                    (a) => a.id !== "sin-kg" && a.id !== "sin-entregas"
                  )
                  .slice(0, 4)
                  .map((a) => (
                    <div
                      key={a.id}
                      className={[
                        "text-sm rounded-xl border px-4 py-3 flex items-start gap-2",
                        a.tone === "danger"
                          ? "bg-red-50 border-red-200 text-red-900"
                          : a.tone === "warning"
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-sky-50 border-sky-200 text-sky-900",
                      ].join(" ")}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs mt-0.5 opacity-90">{a.message}</p>
                      </div>
                      {a.href && (
                        <button
                          type="button"
                          className="text-xs font-medium underline shrink-0"
                          onClick={() => {
                            if (a.href?.includes("modo=")) {
                              const m = parseModeParam(
                                new URL(
                                  a.href,
                                  "http://x"
                                ).searchParams.get("modo")
                              );
                              setModeAndReset(m);
                            } else if (a.href) {
                              router.push(a.href);
                            }
                          }}
                        >
                          Ir
                        </button>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* —— RESUMEN —— */}
          {mode === "resumen" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi
                  icon={DollarSign}
                  color="emerald"
                  label={`Compras (${periodLabel})`}
                  value={formatCurrency(
                    alimentoFilter === "all" ? purchaseCost : filteredPurchaseCost
                  )}
                  sub={`${alimentoFilter === "all" ? purchaseCount : filteredHistory.length} factura(s)`}
                />
                <Kpi
                  icon={Scale}
                  color="blue"
                  label="₡ / kg comprado"
                  value={avgCostPerKg > 0 ? formatCurrency(avgCostPerKg) : "—"}
                  sub={
                    purchasesWithKgCount > 0
                      ? `${purchasesWithKgCount} con kg`
                      : "Captura kg en compras"
                  }
                />
                <Kpi
                  icon={Package}
                  color="amber"
                  label="₡ promedio / compra"
                  value={
                    avgCostPerPurchase > 0
                      ? formatCurrency(avgCostPerPurchase)
                      : "—"
                  }
                />
                <Kpi
                  icon={Wheat}
                  color="lime"
                  label="kg / animal / día"
                  value={
                    hasConsumption
                      ? `${totalDailyConsumption.toFixed(1)} kg`
                      : "—"
                  }
                  sub={
                    hasConsumption
                      ? `${daysWithRecords} día(s) con ración`
                      : "Sin raciones"
                  }
                />
                <Kpi
                  icon={Gauge}
                  color="violet"
                  label="₡ ración / animal / día"
                  value={
                    costPerAnimalDayRacion > 0
                      ? formatCurrency(costPerAnimalDayRacion)
                      : "—"
                  }
                  sub={
                    racionCostPeriod > 0
                      ? `Total raciones ${formatCurrency(racionCostPeriod)}`
                      : undefined
                  }
                />
                <Kpi
                  icon={ClipboardList}
                  color="sky"
                  label="Cobertura raciones"
                  value={
                    coveragePercent != null ? `${coveragePercent}%` : "—"
                  }
                  sub={
                    comparePrev && !allTime
                      ? `Anterior: ${formatCurrency(previousPurchaseCost)}`
                      : undefined
                  }
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Stock estimado</CardTitle>
                  <CardDescription>
                    Entradas (kg reales) − salidas por ración · {periodLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stockByAlimento.filter(
                    (s) =>
                      (alimentoFilter === "all" ||
                        s.alimentoId === alimentoFilter) &&
                      (showInactive ||
                        s.entradasKg > 0 ||
                        s.salidasKg > 0 ||
                        s.entradasComprasSinKg > 0)
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Sin datos de stock (necesitas kg en compras o raciones).
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                              Producto
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                              Entradas
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                              Salidas
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                              Stock
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                              Días
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {stockByAlimento
                            .filter(
                              (s) =>
                                (alimentoFilter === "all" ||
                                  s.alimentoId === alimentoFilter) &&
                                (showInactive ||
                                  s.entradasKg > 0 ||
                                  s.salidasKg > 0 ||
                                  s.entradasComprasSinKg > 0)
                            )
                            .map((s) => (
                              <tr key={s.alimentoId}>
                                <td className="px-3 py-2 font-medium">
                                  {s.nombre}
                                  {s.entradasComprasSinKg > 0 && (
                                    <span className="ml-2 text-[10px] text-amber-700">
                                      {s.entradasComprasSinKg} sin kg
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {s.entradasKg.toLocaleString("es-CR")} kg
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {s.salidasKg.toLocaleString("es-CR")} kg
                                </td>
                                <td
                                  className={[
                                    "px-3 py-2 text-right tabular-nums font-semibold",
                                    s.stockKg < 0 ? "text-red-600" : "",
                                  ].join(" ")}
                                >
                                  {s.stockKg.toLocaleString("es-CR")} kg
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {s.diasCobertura != null
                                    ? `${s.diasCobertura} d`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* —— COMPRAS —— */}
          {mode === "compras" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi
                  icon={DollarSign}
                  color="emerald"
                  label="Costo compras"
                  value={formatCurrency(filteredPurchaseCost)}
                  sub={
                    comparePrev && !allTime
                      ? `Anterior ${formatCurrency(previousPurchaseCost)}`
                      : `${filteredHistory.length} factura(s)`
                  }
                />
                <Kpi
                  icon={Package}
                  color="blue"
                  label="₡ / compra"
                  value={
                    filteredHistory.length > 0
                      ? formatCurrency(
                          filteredPurchaseCost / filteredHistory.length
                        )
                      : "—"
                  }
                />
                <Kpi
                  icon={Scale}
                  color="amber"
                  label="₡ / kg"
                  value={avgCostPerKg > 0 ? formatCurrency(avgCostPerKg) : "—"}
                  sub={`${purchasesWithKgCount} con kg · ${purchasesWithoutKgCount} sin kg`}
                />
                <Kpi
                  icon={FileText}
                  color="violet"
                  label="% con kg"
                  value={
                    purchaseHistory.length > 0
                      ? `${Math.round(
                          (purchasesWithKgCount / purchaseHistory.length) * 100
                        )}%`
                      : "—"
                  }
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-base">
                          {chartView === "fecha"
                            ? "Costo por fecha"
                            : "Costo por alimento"}
                        </CardTitle>
                        <CardDescription>{periodLabel}</CardDescription>
                      </div>
                      <div className="flex rounded-lg border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setChartView("fecha")}
                          className={
                            chartView === "fecha"
                              ? "px-2.5 py-1.5 bg-blue-600 text-white"
                              : "px-2.5 py-1.5 hover:bg-muted"
                          }
                        >
                          Fecha
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartView("alimento")}
                          className={
                            chartView === "alimento"
                              ? "px-2.5 py-1.5 bg-blue-600 text-white border-l"
                              : "px-2.5 py-1.5 border-l hover:bg-muted"
                          }
                        >
                          Alimento
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-12">
                        Sin compras en este filtro.
                      </p>
                    ) : chartView === "fecha" ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={costByPurchaseDate}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#f0f0f0"
                          />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) =>
                              formatCurrencyCompact(Number(v))
                            }
                          />
                          <Tooltip
                            formatter={(v, name) => [
                              formatCurrency(Number(v ?? 0)),
                              String(name),
                            ]}
                          />
                          {purchaseProductNames.length > 1 && (
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          )}
                          {purchaseProductNames.map((name, i) => (
                            <Bar
                              key={name}
                              dataKey={name}
                              stackId="c"
                              fill={
                                PURCHASE_BAR_COLORS[
                                  i % PURCHASE_BAR_COLORS.length
                                ]
                              }
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={compareChartData}
                          layout="vertical"
                          margin={{ left: 10 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            type="number"
                            tickFormatter={(v) =>
                              formatCurrencyCompact(Number(v))
                            }
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={110}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(v, name) => [
                              formatCurrency(Number(v ?? 0)),
                              String(name) === "anterior"
                                ? "Período anterior"
                                : "Actual",
                            ]}
                          />
                          {comparePrev && <Legend wrapperStyle={{ fontSize: 11 }} />}
                          <Bar dataKey="costo" fill="#2563eb" name="Actual" />
                          {comparePrev && (
                            <Bar
                              dataKey="anterior"
                              fill="#94a3b8"
                              name="Anterior"
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detalle insumos</CardTitle>
                    <CardDescription>
                      Precio promedio · filtro alimento aplicado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <InsumosTable rows={filteredFeedTypes} mode="compras" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Historial de compras (PDF)
                      </CardTitle>
                      <CardDescription>
                        Edita kg aquí para obtener ₡/kg
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Buscar…"
                        value={searchHist}
                        onChange={(e) => {
                          setSearchHist(e.target.value);
                          setPageCompras(0);
                        }}
                        className="h-8 w-40 text-sm"
                      />
                      <button
                        type="button"
                        onClick={exportCompras}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Sin compras para este filtro.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-sm min-w-[640px]">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Fecha
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Producto
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                                Cantidad
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                                Costo
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground hidden md:table-cell">
                                Origen
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                                kg
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pagedCompras.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/30">
                                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                                  {formatFechaLarga(row.fecha)}
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {row.alimentoNombre}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {row.cantidad.toLocaleString("es-CR", {
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  {row.unidad}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                  {formatCurrency(row.costo)}
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                                  {row.origen}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {qtyEditId === row.id ? (
                                    <div className="inline-flex gap-1 items-center">
                                      <Input
                                        type="number"
                                        className="h-7 w-20 text-right"
                                        value={qtyEditValue}
                                        onChange={(e) =>
                                          setQtyEditValue(e.target.value)
                                        }
                                        disabled={qtySaving}
                                      />
                                      <button
                                        type="button"
                                        className="text-xs text-emerald-700 font-medium"
                                        disabled={qtySaving}
                                        onClick={() => void saveQty(row)}
                                      >
                                        OK
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => setQtyEditId(null)}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-xs font-medium text-primary hover:underline"
                                      onClick={() => {
                                        setQtyEditId(row.id);
                                        setQtyEditValue(
                                          row.unidad === "compra"
                                            ? ""
                                            : String(row.cantidad)
                                        );
                                      }}
                                    >
                                      Editar kg
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pager
                        page={pageCompras}
                        pageSize={PAGE_SIZE}
                        total={filteredHistory.length}
                        onChange={setPageCompras}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* —— RACIONES —— */}
          {mode === "raciones" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi
                  icon={Scale}
                  color="blue"
                  label="kg / animal / día"
                  value={
                    hasConsumption
                      ? `${totalDailyConsumption.toFixed(1)} kg`
                      : "—"
                  }
                />
                <Kpi
                  icon={Wheat}
                  color="amber"
                  label="kg hato / día"
                  value={
                    hasConsumption
                      ? `${(totalDailyConsumption * animalCount).toFixed(0)} kg`
                      : "—"
                  }
                />
                <Kpi
                  icon={ClipboardList}
                  color="emerald"
                  label="Días con registro"
                  value={String(daysWithRecords)}
                  sub={
                    coveragePercent != null
                      ? `${coveragePercent}% del período`
                      : undefined
                  }
                />
                <Kpi
                  icon={DollarSign}
                  color="violet"
                  label="₡ / animal / día"
                  value={
                    costPerAnimalDayRacion > 0
                      ? formatCurrency(costPerAnimalDayRacion)
                      : "—"
                  }
                  sub="Solo costo de raciones"
                />
              </div>

              {!hasConsumption ? (
                <div className="text-sm rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground space-y-3">
                  <p className="font-medium text-foreground">
                    Sin raciones en {periodLabel}
                  </p>
                  <p>
                    Las compras PDF no cuentan como consumo. Registra entregas
                    diarias para ver kg/animal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateLines(null);
                      setEntregaOpen(true);
                    }}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar primera entrega
                  </button>
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      Consumo diario por tipo
                    </CardTitle>
                    <CardDescription>
                      kg/animal/día · {daysWithRecords} día(s) con observación
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={filteredFeedTypes.filter(
                          (f) => f.dailyConsumption > 0
                        )}
                        layout="vertical"
                        margin={{ left: 10 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#f0f0f0"
                        />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={110}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v) => [
                            `${Number(v ?? 0)} kg/animal/día`,
                            "Consumo",
                          ]}
                        />
                        <Bar
                          dataKey="dailyConsumption"
                          fill="#16a34a"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">
                        Historial de entregas
                      </CardTitle>
                      <CardDescription>
                        Duplicar o anular raciones
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar…"
                        value={searchHist}
                        onChange={(e) => {
                          setSearchHist(e.target.value);
                          setPageEntregas(0);
                        }}
                        className="h-8 w-40 text-sm"
                      />
                      <button
                        type="button"
                        onClick={exportEntregas}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredDeliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Sin entregas en este filtro.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {pagedEntregas.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-xl border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {formatFechaLarga(d.fecha)} ·{" "}
                                {formatCurrency(d.costoTotal)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {d.lineas
                                  .map(
                                    (l) =>
                                      `${l.nombre}: ${l.cantidad.toLocaleString("es-CR")} kg`
                                  )
                                  .join(" · ")}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-muted"
                                onClick={() => {
                                  setDuplicateLines(
                                    d.lineas.map((l) => ({
                                      alimentoId: l.alimentoId,
                                      cantidad: l.cantidad,
                                    }))
                                  );
                                  setEntregaOpen(true);
                                }}
                              >
                                Duplicar
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (
                                    !confirm(
                                      `¿Anular entrega del ${formatFechaLarga(d.fecha)}?`
                                    )
                                  )
                                    return;
                                  void (async () => {
                                    try {
                                      await deleteFeedingDeliveryApi(d.id);
                                      await reload();
                                    } catch (e) {
                                      setActionError(
                                        e instanceof Error
                                          ? e.message
                                          : "Error al anular"
                                      );
                                    }
                                  })();
                                }}
                              >
                                Anular
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Pager
                        page={pageEntregas}
                        pageSize={PAGE_SIZE}
                        total={filteredDeliveries.length}
                        onChange={setPageEntregas}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof DollarSign;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    lime: "bg-lime-50 text-lime-700",
    sky: "bg-sky-50 text-sky-700",
  };
  const text: Record<string, string> = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    lime: "text-lime-700",
    sky: "text-sky-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg[color] ?? bg.emerald}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">
              {label}
            </p>
            <p
              className={`text-base font-bold tabular-nums truncate ${text[color] ?? ""}`}
            >
              {value}
            </p>
            {sub && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {sub}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsumosTable({
  rows,
}: {
  rows: import("@/lib/types/domain").FeedType[];
  mode: "compras" | "raciones";
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin insumos con movimiento. Activa “Sin actividad” para ver el catálogo.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b bg-muted/30">
            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">
              Ingrediente
            </th>
            <th className="px-2 py-2 text-right font-semibold text-muted-foreground">
              Precio
            </th>
            <th className="px-2 py-2 text-right font-semibold text-muted-foreground">
              Cant.
            </th>
            <th className="px-2 py-2 text-right font-semibold text-muted-foreground">
              Costo
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((f) => (
            <tr key={f.id}>
              <td className="px-2 py-1.5 font-medium">{f.name}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                {f.pricePerUnit > 0
                  ? `${formatCurrency(f.pricePerUnit)}${
                      f.priceBasis === "compra" ? "/compra" : `/${f.unit}`
                    }`
                  : "—"}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground text-xs">
                {f.monthlyAmount > 0
                  ? `${f.monthlyAmount.toLocaleString("es-CR", {
                      maximumFractionDigits: 1,
                    })} ${f.unit}`
                  : "—"}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium text-xs">
                {f.monthlyCost > 0 ? formatCurrency(f.monthlyCost) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
      <span>
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
