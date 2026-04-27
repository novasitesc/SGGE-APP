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
import { weightHistory } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ChartWeight() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Peso Promedio</CardTitle>
        <CardDescription>Peso promedio del hato por mes (kg)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={weightHistory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[180, 460]}
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
      </CardContent>
    </Card>
  );
}


