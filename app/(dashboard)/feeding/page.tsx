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
import { fetchFeeding } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Wheat, Scale, DollarSign, Gauge } from "lucide-react";

export default function FeedingPage() {
  const { data: feeding, loading, error } = useApiQuery(fetchFeeding);
  const feedTypes = feeding?.feedTypes ?? [];
  const animalCount = feeding?.activeHeadCount ?? 0;
  const hasConsumption = feeding?.hasConsumptionRecords ?? false;
  const daysWithRecords = feeding?.daysWithRecords ?? 0;
  const totalMonthlyCost = feedTypes.reduce((s, f) => s + f.monthlyCost, 0);
  const totalDailyConsumption =
    feeding?.totalDailyConsumption ??
    feedTypes.reduce((s, f) => s + f.dailyConsumption, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alimentación</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Raciones, consumos y costos de alimentación del hato
          {hasConsumption && daysWithRecords > 0
            ? ` · basado en ${daysWithRecords} día${daysWithRecords !== 1 ? "s" : ""} con registros`
            : ""}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
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
            <p className="font-medium">No hay insumos de alimentación registrados.</p>
            <p className="text-sm mt-1">Agrega alimentos desde Gestión → Alimentación.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Costo (30 días)</p>
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
                    <p className="text-xs text-muted-foreground">Consumo diario / animal</p>
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
                    <p className="text-xs text-muted-foreground">Consumo hato / día</p>
                    <p className="text-lg font-bold text-amber-700">
                      {(totalDailyConsumption * animalCount).toFixed(0)} kg
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
                      {animalCount > 0 && hasConsumption
                        ? formatCurrency(totalMonthlyCost / animalCount / Math.max(daysWithRecords, 1))
                        : formatCurrency(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {!hasConsumption && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Hay insumos en catálogo, pero aún no hay registros de alimentación en los últimos 30 días.
              Los consumos y costos se calcularán a partir de entregas reales registradas en el sistema.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Consumo diario por tipo</CardTitle>
                <CardDescription>Kilogramos por animal por día (promedio del período)</CardDescription>
              </CardHeader>
              <CardContent>
                {!hasConsumption ? (
                  <p className="text-sm text-muted-foreground text-center py-16">Sin consumo registrado.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={feedTypes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value) => [`${Number(value ?? 0)} kg/animal/día`, "Consumo"]} />
                      <Bar dataKey="dailyConsumption" fill="#16a34a" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Costo por tipo (30 días)</CardTitle>
                <CardDescription>Gasto acumulado del período</CardDescription>
              </CardHeader>
              <CardContent>
                {!hasConsumption ? (
                  <p className="text-sm text-muted-foreground text-center py-16">Sin costos de alimentación registrados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={feedTypes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyCompact(Number(v))} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value) => [formatCurrency(Number(value ?? 0)), "Costo"]} />
                      <Bar dataKey="monthlyCost" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de raciones</CardTitle>
              <CardDescription>
                Catálogo de insumos · {animalCount} animales activos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Ingrediente</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">kg/animal/día</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Precio/unidad</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Consumo período</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Costo período</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">% dieta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {feedTypes.map((feed) => (
                      <tr key={feed.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{feed.name}</td>
                        <td className="px-4 py-3 text-right">
                          {hasConsumption ? `${feed.dailyConsumption} ${feed.unit}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(feed.pricePerUnit)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {hasConsumption
                            ? `${feed.monthlyAmount.toLocaleString()} ${feed.unit}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {hasConsumption ? formatCurrency(feed.monthlyCost) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hasConsumption ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${feed.percentage}%` }} />
                              </div>
                              <span className="text-xs font-medium w-8 text-right">{feed.percentage}%</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {hasConsumption && (
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
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
