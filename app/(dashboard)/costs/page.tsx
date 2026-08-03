"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchCosts } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import {
  COST_CATEGORY_KEYS,
  COST_CATEGORY_LABEL,
  costCategoryLabel,
  normalizeCostCategoryKey,
} from "@/lib/costs/categories";
import {
  aggregateCostsByMonth,
  chartRowsFromCategoryTotals,
  computeCostProjection,
  filterCostsByRange,
  totalsByCategoryKey,
} from "@/lib/costs/analytics";
import {
  COST_PERIOD_PRESET_LABEL,
  expandFetchRange,
  resolvePeriodRange,
  type CostPeriodPreset,
} from "@/lib/costs/period";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PAGE_SIZE = 25;

const HIGHLIGHT_CATS = [
  { cat: "alimentación" as const, label: "Alimentación" },
  { cat: "mano_de_obra" as const, label: "Mano de Obra" },
  { cat: "otros" as const, label: "Otros" },
];

export default function CostsPage() {
  // Año actual por defecto: "mes actual" suele quedar vacío a inicios de mes.
  const [periodPreset, setPeriodPreset] = useState<CostPeriodPreset>("año");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterSource, setFilterSource] = useState<string>("todas");
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [page, setPage] = useState(0);

  const periodRange = useMemo(
    () => resolvePeriodRange(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const fetchRange = useMemo(
    () => expandFetchRange(periodRange),
    [periodRange]
  );

  const costsKey = `costs:${fetchRange.from ?? "all"}:${fetchRange.to ?? "all"}`;
  const { data: costs, loading, error } = useApiQuery(
    costsKey,
    () => fetchCosts({ from: fetchRange.from, to: fetchRange.to }),
    [fetchRange.from, fetchRange.to]
  );

  const list = costs ?? [];

  const filtered = useMemo(() => {
    let rows = filterCostsByRange(list, periodRange);
    if (filterSource === "comprobante") {
      rows = rows.filter((c) => c.source === "comprobante");
    } else if (filterSource === "manual") {
      rows = rows.filter((c) => (c.source ?? "manual") === "manual");
    }
    if (filterCategory !== "todas") {
      rows = rows.filter(
        (c) => normalizeCostCategoryKey(c.category) === filterCategory
      );
    }
    return rows;
  }, [list, periodRange, filterSource, filterCategory]);

  const categoryTotals = useMemo(() => totalsByCategoryKey(filtered), [filtered]);
  const costsByCategory = useMemo(
    () => chartRowsFromCategoryTotals(categoryTotals),
    [categoryTotals]
  );
  const monthly = useMemo(() => aggregateCostsByMonth(list, 12), [list]);
  const projection = useMemo(
    () => computeCostProjection(list, filtered, periodRange),
    [list, filtered, periodRange]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const resetPage = () => setPage(0);

  const deltaLabel =
    projection.deltaPct == null
      ? "Sin periodo anterior"
      : `${projection.deltaPct > 0 ? "+" : ""}${projection.deltaPct}% vs anterior`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análisis y proyección operativa · {projection.fromInvoiceCount} desde
            comprobante en el periodo
          </p>
        </div>
        <Link
          href="/gestion/costos"
          className="inline-flex items-center gap-2 self-start lg:self-auto px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          Administrar costos
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <select
              value={periodPreset}
              onChange={(e) => {
                setPeriodPreset(e.target.value as CostPeriodPreset);
                resetPage();
              }}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
            >
              {(Object.keys(COST_PERIOD_PRESET_LABEL) as CostPeriodPreset[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {COST_PERIOD_PRESET_LABEL[key]}
                  </option>
                )
              )}
            </select>
            {periodPreset === "custom" && (
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    resetPage();
                  }}
                  className="px-3 py-2 text-sm rounded-xl border bg-background"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    resetPage();
                  }}
                  className="px-3 py-2 text-sm rounded-xl border bg-background"
                />
              </div>
            )}
            <select
              value={filterSource}
              onChange={(e) => {
                setFilterSource(e.target.value);
                resetPage();
              }}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
              <option value="todas">Todos los orígenes</option>
              <option value="comprobante">Desde factura</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                resetPage();
              }}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
            >
              <option value="todas">Todas las categorías</option>
              {COST_CATEGORY_KEYS.filter((k) => k !== "medicamentos").map((cat) => (
                <option key={cat} value={cat}>
                  {COST_CATEGORY_LABEL[cat]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Costo del periodo
            </p>
            <p className="text-2xl font-bold mt-1 text-red-700">
              {formatCurrency(projection.periodTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{deltaLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ritmo diario
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(projection.dailyAvg)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {projection.recordCount} registros
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Proyección mes
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(projection.projectedMonthEnd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {projection.projectedMonthEnd >= projection.monthToDate ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              MTD {formatCurrency(projection.monthToDate)}
            </p>
          </CardContent>
        </Card>
        {HIGHLIGHT_CATS.map(({ cat, label }) => {
          const catTotal = categoryTotals.get(cat) ?? 0;
          return (
            <Card key={cat}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(catTotal)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {projection.periodTotal > 0
                    ? `${((catTotal / projection.periodTotal) * 100).toFixed(0)}% del periodo`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Proyección de fin de mes basada en el ritmo del mes en curso (día{" "}
        {projection.daysElapsedInMonth} de {projection.daysInMonth}).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Costos por Categoría</CardTitle>
            <CardDescription>Distribución del periodo filtrado</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] animate-pulse bg-muted/30 rounded-xl" />
            ) : costsByCategory.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-16 space-y-1">
                <p>No hay gastos en el periodo seleccionado.</p>
                {list.length > 0 && (
                  <p>
                    Hay {list.length} registros en el historial cargado — prueba{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setPeriodPreset("año");
                        resetPage();
                      }}
                    >
                      Año actual
                    </button>
                    ,{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setPeriodPreset("90d");
                        resetPage();
                      }}
                    >
                      Últimos 90 días
                    </button>{" "}
                    o{" "}
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setPeriodPreset("todo");
                        resetPage();
                      }}
                    >
                      Todo el historial
                    </button>
                    .
                  </p>
                )}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={costsByCategory}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-15}
                    textAnchor="end"
                    height={40}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {costsByCategory.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumen por Rubro</CardTitle>
            {projection.topCategoryKey && (
              <CardDescription>
                Mayor rubro: {COST_CATEGORY_LABEL[projection.topCategoryKey]}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {costsByCategory.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm">{cat.category}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(cat.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {projection.periodTotal > 0
                      ? `${((cat.amount / projection.periodTotal) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Total periodo
              </span>
              <span className="text-red-700">
                {formatCurrency(projection.periodTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia mensual</CardTitle>
          <CardDescription>Últimos 12 meses (datos cargados)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[220px] animate-pulse bg-muted/30 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
                />
                <Bar dataKey="amount" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Registro de Gastos
          </CardTitle>
          <CardDescription>
            Incluye altas manuales y gastos confirmados desde{" "}
            <Link
              href="/gestion/comprobantes"
              className="text-primary underline-offset-2 hover:underline"
            >
              Comprobantes
            </Link>
            . Gestiona altas y ediciones en{" "}
            <Link
              href="/gestion/costos"
              className="text-primary underline-offset-2 hover:underline"
            >
              Administración de costos
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted/30 rounded-xl" />
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 space-y-1">
              <p>No hay gastos con los filtros aplicados.</p>
              {list.length > 0 && (
                <p>
                  Amplía el periodo (p. ej. Año actual o Todo el historial) para
                  ver los {list.length} registros cargados.
                </p>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(cost.date)}
                      </TableCell>
                      <TableCell>
                        {cost.source === "comprobante" ? (
                          <Badge variant="info" className="gap-1">
                            <FileText className="h-3 w-3" />
                            Factura
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {costCategoryLabel(cost.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{cost.description}</p>
                        {cost.issuer && (
                          <p className="text-xs text-muted-foreground">{cost.issuer}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(cost.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t mt-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando {safePage * PAGE_SIZE + 1}–
                  {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de{" "}
                  {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-right sm:min-w-[140px]">
                  <p className="text-xs text-muted-foreground">Total periodo</p>
                  <p className="text-xl font-bold text-red-700">
                    {formatCurrency(projection.periodTotal)}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
