"use client";

import type { ElementType } from "react";
import ChartWeight from "@/components/ChartWeight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatModuleLabel } from "@/lib/modulos/constants";
import { formatNumber } from "@/lib/utils";
import type { KpiSummary, Module, WeightRecord } from "@/lib/types/domain";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Beef, Scale, Target, BarChart2 } from "lucide-react";

type Props = {
  kpi?: KpiSummary | null;
  weightHistory: WeightRecord[];
  modules: Module[];
  loadingWeight?: boolean;
  loadingModules?: boolean;
};

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </p>
          <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardTabOperativo({
  kpi,
  weightHistory,
  modules,
  loadingWeight,
  loadingModules,
}: Props) {
  const occupancy = modules
    .map((m) => ({
      name: formatModuleLabel(m.id, m.name),
      ocupacion: m.animalCount,
      capacidad: m.capacity,
      pct:
        m.capacity > 0
          ? Math.round((m.animalCount / m.capacity) * 100)
          : 0,
      avgWeight: m.avgWeightActive ?? 0,
    }))
    .sort((a, b) => b.ocupacion - a.ocupacion)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat
          label="Activos"
          value={String(kpi?.activeAnimals ?? 0)}
          icon={Beef}
          color="text-emerald-700"
        />
        <MiniStat
          label="Totales"
          value={String(kpi?.totalAnimals ?? 0)}
          icon={Scale}
          color="text-blue-700"
        />
        <MiniStat
          label="GDP"
          value={`${formatNumber(kpi?.avgDailyGain ?? 0, 2)} kg/d`}
          icon={Target}
          color="text-violet-700"
        />
        <MiniStat
          label="Conversión"
          value={`${formatNumber(kpi?.feedConversionRatio ?? 0, 1)}:1`}
          icon={BarChart2}
          color="text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWeight data={weightHistory} loading={loadingWeight} />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Ocupación de módulos</CardTitle>
              <a
                href="/gestion/animales"
                className="text-xs text-primary hover:underline"
              >
                Ver animales
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {loadingModules ? (
              <div className="h-[280px] animate-pulse bg-muted/30 rounded-xl" />
            ) : occupancy.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">
                Sin módulos con animales en este lote.
              </p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={occupancy}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#f0f0f0"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        value as number,
                        name === "ocupacion" ? "Animales" : "Capacidad",
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="ocupacion"
                      name="ocupacion"
                      fill="#16a34a"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {occupancy.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between text-xs border-b last:border-0 py-1"
                    >
                      <span className="font-medium truncate mr-2">{m.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {m.ocupacion}/{m.capacidad} ({m.pct}%)
                        {m.avgWeight > 0
                          ? ` · ${formatNumber(m.avgWeight, 0)} kg`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
