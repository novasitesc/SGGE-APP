"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type PieLabelRenderProps,
} from "recharts";
import type { CostByCategory } from "@/lib/types/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const RADIAN = Math.PI / 180;

const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;
  if (Number(percent) < 0.05) return null;
  const iR = Number(innerRadius);
  const oR = Number(outerRadius);
  const mA = Number(midAngle);
  const radius = iR + (oR - iR) * 0.5;
  const x = Number(cx) + radius * Math.cos(-mA * RADIAN);
  const y = Number(cy) + radius * Math.sin(-mA * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${(Number(percent) * 100).toFixed(0)}%`}
    </text>
  );
};

interface ChartCostsProps {
  data?: CostByCategory[];
  loading?: boolean;
}

export default function ChartCosts({ data = [], loading }: ChartCostsProps) {
  const total = data.reduce((s, c) => s + c.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Costos</CardTitle>
        <CardDescription>Total: {formatCurrency(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[280px] animate-pulse bg-muted/30 rounded-xl" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            No hay gastos registrados aún.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={110}
                dataKey="amount"
                nameKey="category"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name]}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "#374151" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
