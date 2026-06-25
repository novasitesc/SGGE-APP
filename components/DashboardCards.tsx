"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { KpiSummary } from "@/lib/types/domain";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Scale,
  TrendingUp,
  BarChart2,
  DollarSign,
  Receipt,
  Banknote,
  PiggyBank,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function KpiCard({ title, value, subtitle, icon: Icon, color, bgColor }: KpiCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p className={cn("text-2xl font-bold leading-none", color)}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ml-3", bgColor)}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_KPI: KpiSummary = {
  totalAnimals: 0,
  activeAnimals: 0,
  avgCurrentWeight: 0,
  avgDailyGain: 0,
  feedConversionRatio: 0,
  costPerKg: 0,
  totalCost: 0,
  totalRevenue: 0,
  netProfit: 0,
  profitability: 0,
};

interface DashboardCardsProps {
  kpi?: KpiSummary | null;
  loading?: boolean;
}

export default function DashboardCards({ kpi, loading }: DashboardCardsProps) {
  const data = kpi ?? EMPTY_KPI;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5 h-24 bg-muted/30" />
          </Card>
        ))}
      </div>
    );
  }

  const cards: KpiCardProps[] = [
    {
      title: "Peso Promedio",
      value: `${formatNumber(data.avgCurrentWeight, 1)} kg`,
      subtitle: "Peso actual promedio / animal",
      icon: Scale,
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Ganancia Diaria (GDP)",
      value: `${formatNumber(data.avgDailyGain, 2)} kg/día`,
      subtitle: "Promedio del hato",
      icon: TrendingUp,
      color: "text-blue-700",
      bgColor: "bg-blue-50",
    },
    {
      title: "Conversión Alimenticia",
      value: `${formatNumber(data.feedConversionRatio, 1)}:1`,
      subtitle: "kg alimento / kg ganado",
      icon: BarChart2,
      color: "text-violet-700",
      bgColor: "bg-violet-50",
    },
    {
      title: "Costo por kg",
      value: formatCurrency(data.costPerKg),
      subtitle: "Costo de producción",
      icon: DollarSign,
      color: "text-amber-700",
      bgColor: "bg-amber-50",
    },
    {
      title: "Costo Total",
      value: formatCurrency(data.totalCost),
      subtitle: "Acumulado del ciclo",
      icon: Receipt,
      color: "text-red-700",
      bgColor: "bg-red-50",
    },
    {
      title: "Ingresos Totales",
      value: formatCurrency(data.totalRevenue),
      subtitle: "Por ventas realizadas",
      icon: Banknote,
      color: "text-green-700",
      bgColor: "bg-green-50",
    },
    {
      title: "Utilidad Neta",
      value: formatCurrency(data.netProfit),
      subtitle: "Ingresos – Costos",
      icon: PiggyBank,
      color: data.netProfit >= 0 ? "text-green-700" : "text-red-600",
      bgColor: data.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      title: "Rentabilidad",
      value: `${formatNumber(data.profitability, 1)}%`,
      subtitle: "Sobre el costo total",
      icon: Percent,
      color: data.profitability >= 0 ? "text-green-700" : "text-red-600",
      bgColor: data.profitability >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  );
}
