"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { feedTypes } from "@/lib/mockData";
import { formatCurrency } from "@/lib/utils";
import { Wheat, Scale, DollarSign, Gauge } from "lucide-react";

export default function FeedingPage() {
  const totalMonthlyCost = feedTypes.reduce((s, f) => s + f.monthlyCost, 0);
  const totalDailyConsumption = feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);
  const ANIMAL_COUNT = 18;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alimentación</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Raciones, consumos y costos de alimentación del hato
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo Mensual</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalMonthlyCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Scale className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Diario / animal</p>
                <p className="text-lg font-bold text-blue-700">{totalDailyConsumption.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Wheat className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Hato/día</p>
                <p className="text-lg font-bold text-amber-700">
                  {(totalDailyConsumption * ANIMAL_COUNT).toFixed(0)} kg
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo / animal / día</p>
                <p className="text-lg font-bold text-violet-700">
                  {formatCurrency(totalMonthlyCost / ANIMAL_COUNT / 30)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart consumption */}
        <Card>
          <CardHeader>
            <CardTitle>Consumo Diario por Tipo</CardTitle>
            <CardDescription>Kilogramos por animal por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={feedTypes}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(value) => [`${Number(value ?? 0)} kg/animal/día`, "Consumo"]}
                />
                <Bar dataKey="dailyConsumption" fill="#16a34a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost chart */}
        <Card>
          <CardHeader>
            <CardTitle>Costo Mensual por Tipo</CardTitle>
            <CardDescription>Gasto total mensual del hato</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={feedTypes}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Costo mensual"]}
                />
                <Bar dataKey="monthlyCost" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Feed table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Raciones</CardTitle>
          <CardDescription>Componentes de la dieta – {ANIMAL_COUNT} animales en producción</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Ingrediente</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">kg/animal/día</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Precio/kg</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Consumo Mensual</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costo Mensual</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">% Dieta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {feedTypes.map((feed) => (
                  <tr key={feed.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{feed.name}</td>
                    <td className="px-4 py-3 text-right">{feed.dailyConsumption} {feed.unit}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(feed.pricePerUnit)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {feed.monthlyAmount.toLocaleString()} {feed.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(feed.monthlyCost)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${feed.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{feed.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold bg-muted/20">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{totalDailyConsumption.toFixed(2)} kg</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right">
                    {feedTypes.reduce((s, f) => s + f.monthlyAmount, 0).toLocaleString()} kg
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {formatCurrency(totalMonthlyCost)}
                  </td>
                  <td className="px-4 py-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


