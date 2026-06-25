"use client";

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ChartWeightProps {
  data?: WeightRecord[];
  loading?: boolean;
}

export default function ChartWeight({ data = [], loading }: ChartWeightProps) {
  const maxWeight = data.length > 0
    ? Math.max(...data.map((d) => d.avgWeight)) * 1.2
    : 500;
  const minWeight = data.length > 0
    ? Math.min(...data.map((d) => d.avgWeight)) * 0.8
    : 0;

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
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minWeight, maxWeight]}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v} kg`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                formatter={(value) => [`${Number(value ?? 0)} kg`, "Peso Promedio"]}
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
