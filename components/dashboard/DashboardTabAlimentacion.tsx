"use client";

import type { ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeedingResponse } from "@/lib/api/data-client";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Percent,
  ShoppingBag,
  Utensils,
  Wheat,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  feeding: FeedingResponse | null;
  feedCostApproxPerDay?: number;
  loading?: boolean;
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

export default function DashboardTabAlimentacion({
  feeding,
  feedCostApproxPerDay = 0,
  loading,
}: Props) {
  const stock = (feeding?.stockByAlimento ?? [])
    .filter((s) => s.stockKg > 0 || (s.diasCobertura ?? 0) > 0)
    .slice(0, 8);

  const stockChart = stock.map((s) => ({
    name: s.nombre.length > 14 ? `${s.nombre.slice(0, 14)}…` : s.nombre,
    stockKg: Math.round(s.stockKg * 10) / 10,
    dias: s.diasCobertura ?? 0,
  }));

  const coverage =
    feeding?.coveragePercent == null
      ? "—"
      : `${formatNumber(feeding.coveragePercent, 0)}%`;

  const toneClass = (tone: "warning" | "danger" | "info") => {
    if (tone === "danger") return "border-red-200 bg-red-50 text-red-800";
    if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-blue-200 bg-blue-50 text-blue-900";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-16 bg-muted/30" />
            </Card>
          ))}
        </div>
        <div className="h-[280px] animate-pulse bg-muted/30 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Período {feeding?.periodDays ?? 30} días
          {feeding?.comprasCompartidasGranja
            ? " · compras compartidas de granja"
            : ""}
        </p>
        <a
          href="/gestion/alimentacion"
          className="text-xs text-primary hover:underline"
        >
          Ver alimentación
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStat
          label="Consumo / día"
          value={`${formatNumber(feeding?.totalDailyConsumption ?? 0, 1)} kg`}
          icon={Wheat}
          color="text-emerald-700"
        />
        <MiniStat
          label="₡ · animal · día"
          value={formatCurrency(feeding?.costPerAnimalDayRacion ?? 0)}
          icon={Utensils}
          color="text-orange-700"
        />
        <MiniStat
          label="Cobertura"
          value={coverage}
          icon={Percent}
          color="text-blue-700"
        />
        <MiniStat
          label="Compras período"
          value={formatCurrency(feeding?.purchaseCostPeriod ?? 0)}
          icon={ShoppingBag}
          color="text-violet-700"
        />
        <MiniStat
          label="Costo alim./día"
          value={formatCurrency(feedCostApproxPerDay)}
          icon={Utensils}
          color="text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stock por alimento</CardTitle>
          </CardHeader>
          <CardContent>
            {stockChart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sin stock registrado en el período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stockChart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f0f0f0"
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "stockKg"
                        ? `${Number(value)} kg`
                        : `${Number(value)} días`,
                      name === "stockKg" ? "Stock" : "Cobertura",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="stockKg"
                    name="stockKg"
                    fill="#16a34a"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            {stock.length > 0 && (
              <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {stock.map((s) => (
                  <div
                    key={s.alimentoId}
                    className="flex justify-between text-xs border-b last:border-0 py-1"
                  >
                    <span className="truncate mr-2">{s.nombre}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatNumber(s.stockKg, 1)} kg
                      {s.diasCobertura != null
                        ? ` · ${formatNumber(s.diasCobertura, 0)} d`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas de alimentación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(feeding?.alerts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sin alertas de alimentación.
              </p>
            ) : (
              <div className="space-y-2">
                {(feeding?.alerts ?? []).map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-xl border px-3 py-2 text-xs ${toneClass(a.tone)}`}
                  >
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-0.5 opacity-90">{a.message}</p>
                    {a.href && (
                      <a
                        href={a.href}
                        className="inline-block mt-1 underline font-medium"
                      >
                        Revisar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
