"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { monthlyFinancials, kpiSummary, animals, costs, feedTypes } from "@/lib/mockData";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { BarChart3, TrendingUp, TrendingDown, Target, Beef, DollarSign } from "lucide-react";

export default function ReportsPage() {
  const kpi = kpiSummary;
  const totalCost = costs.reduce((s, c) => s + c.amount, 0);
  const activeAnimals = animals.filter((a) => a.status === "activo").length;
  const soldAnimals = animals.filter((a) => a.status === "vendido").length;
  const avgGain = animals
    .filter((a) => a.status === "activo")
    .reduce((s, a) => s + (a.currentWeight - a.initialWeight), 0) / activeAnimals;

  const feedEfficiency = feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);
  const costPerAnimal = totalCost / animals.length;

  /** El eje Y debe cruzar siempre 0; si no, Recharts usa el mínimo del dominio como base y las barras “flotan”. */
  const financialYDomain = useMemo((): [number, number] => {
    const values = monthlyFinancials.flatMap((d) => [d.costs, d.revenue, d.profit]);
    const rawMin = Math.min(...values, 0);
    const rawMax = Math.max(...values, 0);
    const span = Math.max(rawMax - rawMin, 1);
    const pad = span * 0.06;
    return [rawMin - pad, rawMax + pad];
  }, []);

  const metricsData = [
    { label: "Animales Activos", value: activeAnimals, icon: Beef, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Animales Vendidos", value: soldAnimals, icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "GDP Promedio", value: `${formatNumber(kpi.avgDailyGain, 2)} kg/día`, icon: Target, color: "text-violet-700", bg: "bg-violet-50" },
    { label: "C.A. Promedio", value: `${formatNumber(kpi.feedConversionRatio, 1)}:1`, icon: BarChart3, color: "text-amber-700", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Análisis financiero y productivo del ciclo de engorda
        </p>
      </div>

      {/* Key metrics */}
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
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial chart */}
      <Card>
        <CardHeader>
          <CardTitle>Flujo Financiero Mensual</CardTitle>
          <CardDescription>Costos, ingresos y utilidad por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthlyFinancials} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={financialYDomain}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name as string]}
              />
              <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
              <Bar dataKey="costs" name="Costos" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Bar dataKey="revenue" name="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Line
                type="monotone"
                dataKey="profit"
                name="Utilidad"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profitability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-green-600" />
              Rentabilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Inversión Total", value: formatCurrency(kpi.totalCost), color: "text-red-700" },
              { label: "Ingresos por Ventas", value: formatCurrency(kpi.totalRevenue), color: "text-green-700" },
              { label: "Utilidad Neta", value: formatCurrency(kpi.netProfit), color: kpi.netProfit >= 0 ? "text-green-700" : "text-red-600" },
              { label: "Rentabilidad", value: `${formatNumber(kpi.profitability, 1)}%`, color: kpi.profitability >= 0 ? "text-green-700" : "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cost per animal */}
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
              { label: "Costo / kg producido", value: formatCurrency(kpi.costPerKg) },
              { label: "Costo alimentación/día", value: formatCurrency(feedTypes.reduce((s, f) => s + f.monthlyCost, 0) / animals.length / 30) },
              { label: "Precio de venta prom.", value: `${formatCurrency(47.5)}/kg` },
              { label: "Margen bruto estimado", value: `${formatCurrency(47.5 - kpi.costPerKg)}/kg` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-bold">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Feed efficiency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-violet-600" />
              Eficiencia Productiva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "GDP promedio", value: `${formatNumber(kpi.avgDailyGain, 2)} kg/día`, progress: (kpi.avgDailyGain / 2) * 100 },
              { label: "Conversión alimenticia", value: `${kpi.feedConversionRatio}:1`, progress: Math.max(0, 100 - ((kpi.feedConversionRatio - 5) / 10) * 100) },
              { label: "Consumo diario/animal", value: `${feedEfficiency.toFixed(1)} kg`, progress: 70 },
              { label: "Ganancia promedio total", value: `${formatNumber(avgGain, 0)} kg/animal`, progress: (avgGain / 200) * 100 },
            ].map(({ label, value, progress }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
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

      {/* Monthly financial table */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero por Mes</CardTitle>
        </CardHeader>
        <CardContent>
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
                {monthlyFinancials.map((row) => {
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
                    {formatCurrency(monthlyFinancials.reduce((s, r) => s + r.costs, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {formatCurrency(monthlyFinancials.reduce((s, r) => s + r.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(monthlyFinancials.reduce((s, r) => s + r.profit, 0))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNumber(
                      (monthlyFinancials.reduce((s, r) => s + r.profit, 0) /
                        monthlyFinancials.reduce((s, r) => s + r.costs, 0)) *
                        100,
                      1
                    )}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
