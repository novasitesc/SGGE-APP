"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fetchAnimals } from "@/lib/api/animals-client";
import { fetchCosts, fetchDashboard, fetchFeeding, fetchFinancialReports } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/utils";
import { BarChart3, TrendingUp, TrendingDown, Target, Beef, DollarSign } from "lucide-react";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import { loteLabel } from "@/lib/lotes/active-lote";

export default function ReportsPage() {
  const { loteId, lote } = useActiveLote();
  const dashLoader = useCallback(() => fetchDashboard(loteId), [loteId]);
  const animalsLoader = useCallback(() => fetchAnimals(loteId), [loteId]);

  const { data: dashboard, loading: loadingDash } = useApiQuery(
    loteId ? `dashboard:${loteId}` : "dashboard",
    dashLoader,
    [loteId],
    { enabled: !!loteId }
  );
  const { data: monthlyFinancials, loading: loadingFin } = useApiQuery(
    "reports:financial",
    fetchFinancialReports
  );
  const { data: animals, loading: loadingAnimals } = useApiQuery(
    loteId ? `animals:${loteId}` : "animals",
    animalsLoader,
    [loteId],
    { enabled: !!loteId }
  );
  // Costos: compartidos a nivel granja (no dependen del lote).
  const { data: costs, loading: loadingCosts } = useApiQuery("costs", fetchCosts);
  const { data: feeding, loading: loadingFeed } = useApiQuery(
    "feeding",
    fetchFeeding
  );

  const kpi = dashboard?.kpiSummary;
  const list = costs ?? [];
  const animalList = animals ?? [];
  const feedTypes = feeding?.feedTypes ?? [];
  const financials = monthlyFinancials ?? [];

  const totalCost = list.reduce((s, c) => s + c.amount, 0);
  const activeAnimals = animalList.filter((a) => a.status === "activo").length;
  const soldAnimals = animalList.filter((a) => a.status === "vendido").length;
  const avgGain = activeAnimals > 0
    ? animalList
        .filter((a) => a.status === "activo")
        .reduce((s, a) => s + (a.currentWeight - a.initialWeight), 0) / activeAnimals
    : 0;

  const feedEfficiency = feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);
  const costPerAnimal = animalList.length > 0 ? totalCost / animalList.length : 0;
  const avgSalePrice = (dashboard?.recentSales ?? []).length > 0
    ? (dashboard?.recentSales ?? []).reduce((s, v) => s + v.pricePerKg, 0) / (dashboard?.recentSales ?? []).length
    : 0;

  const barYMax = useMemo(() => {
    const peak = Math.max(
      ...financials.flatMap((d) => [d.costs, d.revenue]),
      1
    );
    return peak * 1.08;
  }, [financials]);

  const profitYDomain = useMemo((): [number, number] => {
    if (financials.length === 0) return [-1000, 1000];
    const profits = financials.map((d) => d.profit);
    const rawMin = Math.min(...profits, 0);
    const rawMax = Math.max(...profits, 0);
    const span = Math.max(rawMax - rawMin, 1);
    const pad = span * 0.1;
    return [rawMin - pad, rawMax + pad];
  }, [financials]);

  const loading = loadingDash || loadingFin || loadingAnimals || loadingCosts || loadingFeed;

  const metricsData = [
    { label: "Animales Activos", value: activeAnimals, icon: Beef, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Animales Vendidos", value: soldAnimals, icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "GDP Promedio", value: `${formatNumber(kpi?.avgDailyGain ?? 0, 2)} kg/día`, icon: Target, color: "text-violet-700", bg: "bg-violet-50" },
    { label: "C.A. Promedio", value: `${formatNumber(kpi?.feedConversionRatio ?? 0, 1)}:1`, icon: BarChart3, color: "text-amber-700", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Productividad del lote {loteLabel(lote)} · costos financieros de la
          granja (compartidos)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricsData.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{loading ? "…" : value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujo Financiero Mensual</CardTitle>
          <CardDescription>Costos, ingresos y utilidad por mes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingFin ? (
            <div className="h-[400px] animate-pulse bg-muted/30 rounded-xl" />
          ) : financials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">Sin datos financieros registrados.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Costos e ingresos (arriba) y utilidad neta (abajo) usan escalas distintas.
              </p>
              <div className="rounded-xl border bg-card/50 overflow-hidden">
                <div className="border-b bg-muted/30 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Costos vs ingresos
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={financials} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} syncId="flujoFinanciero">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, barYMax]}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                      formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name as string]}
                    />
                    <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                    <Bar dataKey="costs" name="Costos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="revenue" name="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="border-t bg-muted/30 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Utilidad neta por mes
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={financials} margin={{ top: 12, right: 12, left: 0, bottom: 8 }} syncId="flujoFinanciero">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={profitYDomain}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                      width={44}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                      formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name as string]}
                    />
                    <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Utilidad"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-green-600" />
              Rentabilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Inversión Total", value: formatCurrency(kpi?.totalCost ?? 0), color: "text-red-700" },
              { label: "Ingresos por Ventas", value: formatCurrency(kpi?.totalRevenue ?? 0), color: "text-green-700" },
              { label: "Utilidad Neta", value: formatCurrency(kpi?.netProfit ?? 0), color: (kpi?.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600" },
              { label: "Rentabilidad", value: `${formatNumber(kpi?.profitability ?? 0, 1)}%`, color: (kpi?.profitability ?? 0) >= 0 ? "text-green-700" : "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{loadingDash ? "…" : value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Costos por Animal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Costo total / animal", value: formatCurrency(costPerAnimal) },
              { label: "Costo / kg producido", value: formatCurrency(kpi?.costPerKg ?? 0) },
              {
                label: "Costo alimentación/día",
                value: animalList.length > 0
                  ? formatCurrency(feedTypes.reduce((s, f) => s + f.monthlyCost, 0) / animalList.length / 30)
                  : formatCurrency(0),
              },
              { label: "Precio de venta prom.", value: `${formatCurrency(avgSalePrice)}/kg` },
              {
                label: "Margen bruto estimado",
                value: `${formatCurrency(avgSalePrice - (kpi?.costPerKg ?? 0))}/kg`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-bold">{loading ? "…" : value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-violet-600" />
              Eficiencia Productiva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "GDP promedio", value: `${formatNumber(kpi?.avgDailyGain ?? 0, 2)} kg/día`, progress: ((kpi?.avgDailyGain ?? 0) / 2) * 100 },
              { label: "Conversión alimenticia", value: `${kpi?.feedConversionRatio ?? 0}:1`, progress: Math.max(0, 100 - (((kpi?.feedConversionRatio ?? 0) - 5) / 10) * 100) },
              { label: "Consumo diario/animal", value: `${feedEfficiency.toFixed(1)} kg`, progress: 70 },
              { label: "Ganancia promedio total", value: `${formatNumber(avgGain, 0)} kg/animal`, progress: (avgGain / 200) * 100 },
            ].map(({ label, value, progress }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{loading ? "…" : value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          {financials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos financieros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Mes</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costos</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Ingresos</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Utilidad</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rentabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {financials.map((row) => {
                    const profitability = row.costs > 0 ? (row.profit / row.costs) * 100 : 0;
                    return (
                      <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.month}</td>
                        <td className="px-4 py-3 text-right text-red-700">{formatCurrency(row.costs)}</td>
                        <td className="px-4 py-3 text-right text-green-700">
                          {row.revenue > 0 ? formatCurrency(row.revenue) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {formatCurrency(row.profit)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${profitability >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {formatNumber(profitability, 1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold bg-muted/20">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {formatCurrency(financials.reduce((s, r) => s + r.costs, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {formatCurrency(financials.reduce((s, r) => s + r.revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(financials.reduce((s, r) => s + r.profit, 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(
                        (financials.reduce((s, r) => s + r.profit, 0) /
                          Math.max(financials.reduce((s, r) => s + r.costs, 0), 1)) *
                          100,
                        1
                      )}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
