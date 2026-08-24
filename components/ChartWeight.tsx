"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { WeightRecord } from "@/lib/types/domain";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ChartWeightProps {
  data?: WeightRecord[];
  loading?: boolean;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

/** Escala redonda en kg, pocos ticks, sin decimales flotantes. */
function niceKgScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, 25);
  const rawMin = Math.max(0, lo - pad);
  const rawMax = hi + pad;
  const step = niceStep(Math.max(rawMax - rawMin, 50) / 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(Math.round(v));
  }
  return { domain: [min, max === min ? min + step : max], ticks };
}

export default function ChartWeight({ data = [], loading }: ChartWeightProps) {
  const scale = useMemo(() => {
    if (data.length === 0) {
      return { domain: [0, 500] as [number, number], ticks: [0, 100, 200, 300, 400, 500] };
    }
    return niceKgScale(data.map((d) => d.avgWeight));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Peso Promedio</CardTitle>
        <CardDescription>Peso promedio del hato por mes (kg)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[280px] animate-pulse bg-muted/30 rounded-xl" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            No hay pesajes registrados aún.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={scale.domain}
                ticks={scale.ticks}
                allowDecimals={false}
                width={36}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => String(Math.round(Number(v)))}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `${formatNumber(Number(value ?? 0), 1)} kg`,
                  "Peso Promedio",
                ]}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{value}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="avgWeight"
                name="Peso Promedio"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#16a34a", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#16a34a" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
