"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TREATMENT_TYPE_LABELS,
  type TreatmentType,
} from "@/modules/salud/types/salud.types";

type TrendPoint = { month: string; count: number; cost: number };
type CostByType = { type: string; amount: number };

type Props = {
  trend: TrendPoint[];
  costByType: CostByType[];
};

export function ChartSalud({ trend, costByType }: Props) {
  const typeData = costByType.map((c) => ({
    ...c,
    label:
      TREATMENT_TYPE_LABELS[c.type as TreatmentType] ?? c.type,
  }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-medium mb-3">Tendencia (tratamientos / mes)</p>
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Sin datos en el período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Tratamientos" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div>
        <p className="text-sm font-medium mb-3">Costo por tipo</p>
        {typeData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Sin costos registrados.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="amount" name="₡" fill="#b45309" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
