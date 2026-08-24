"use client";

import { useMemo } from "react";
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
import type { MonthlyFinancial } from "@/lib/types/domain";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

interface ChartFinancialProps {
  data?: MonthlyFinancial[];
  loading?: boolean;
}

export default function ChartFinancial({
  data = [],
  loading,
}: ChartFinancialProps) {
  const barYMax = useMemo(() => {
    const peak = Math.max(...data.flatMap((d) => [d.costs, d.revenue]), 1);
    return peak * 1.08;
  }, [data]);

  const profitYDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [-1000, 1000];
    const profits = data.map((d) => d.profit);
    const rawMin = Math.min(...profits, 0);
    const rawMax = Math.max(...profits, 0);
    const span = Math.max(rawMax - rawMin, 1);
    const pad = span * 0.1;
    return [rawMin - pad, rawMax + pad];
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo financiero mensual</CardTitle>
        <CardDescription>
          Costos, ingresos y utilidad neta por mes (granja)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="h-[380px] animate-pulse bg-muted/30 rounded-xl" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            No hay movimientos financieros registrados aún.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Costos e ingresos (arriba) y utilidad neta (abajo) usan escalas
              distintas.
            </p>
            <div className="rounded-xl border bg-card/50 overflow-hidden">
              <div className="border-b bg-muted/30 px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Costos vs ingresos
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data}
                  margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
                  syncId="dashFlujoFinanciero"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, barYMax]}
                    tickCount={5}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name as string,
                    ]}
                  />
                  <Legend
                    formatter={(v) => (
                      <span style={{ fontSize: 12 }}>{v}</span>
                    )}
                  />
                  <Bar
                    dataKey="costs"
                    name="Costos"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Ingresos"
                    fill="#16a34a"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="border-t bg-muted/30 px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Utilidad neta por mes
                </p>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={data}
                  margin={{ top: 12, right: 8, left: 4, bottom: 8 }}
                  syncId="dashFlujoFinanciero"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={profitYDomain}
                    tickCount={5}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                    width={52}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name as string,
                    ]}
                  />
                  <Legend
                    formatter={(v) => (
                      <span style={{ fontSize: 12 }}>{v}</span>
                    )}
                  />
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
  );
}
