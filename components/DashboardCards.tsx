import { Card, CardContent } from "@/components/ui/card";
import { kpiSummary } from "@/lib/mockData";
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
  trend?: "up" | "down" | "neutral";
}

function KpiCard({ title, value, subtitle, icon: Icon, color, bgColor, trend }: KpiCardProps) {
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

export default function DashboardCards() {
  const kpi = kpiSummary;

  const cards: KpiCardProps[] = [
    {
      title: "Peso Promedio",
      value: `${formatNumber(kpi.avgCurrentWeight, 1)} kg`,
      subtitle: "Peso actual promedio / animal",
      icon: Scale,
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Ganancia Diaria (GDP)",
      value: `${formatNumber(kpi.avgDailyGain, 2)} kg/día`,
      subtitle: "Promedio del hato",
      icon: TrendingUp,
      color: "text-blue-700",
      bgColor: "bg-blue-50",
    },
    {
      title: "Conversión Alimenticia",
      value: `${formatNumber(kpi.feedConversionRatio, 1)}:1`,
      subtitle: "kg alimento / kg ganado",
      icon: BarChart2,
      color: "text-violet-700",
      bgColor: "bg-violet-50",
    },
    {
      title: "Costo por kg",
      value: formatCurrency(kpi.costPerKg),
      subtitle: "Costo de producción",
      icon: DollarSign,
      color: "text-amber-700",
      bgColor: "bg-amber-50",
    },
    {
      title: "Costo Total",
      value: formatCurrency(kpi.totalCost),
      subtitle: "Acumulado del ciclo",
      icon: Receipt,
      color: "text-red-700",
      bgColor: "bg-red-50",
    },
    {
      title: "Ingresos Totales",
      value: formatCurrency(kpi.totalRevenue),
      subtitle: "Por ventas realizadas",
      icon: Banknote,
      color: "text-green-700",
      bgColor: "bg-green-50",
    },
    {
      title: "Utilidad Neta",
      value: formatCurrency(kpi.netProfit),
      subtitle: "Ingresos – Costos",
      icon: PiggyBank,
      color: kpi.netProfit >= 0 ? "text-green-700" : "text-red-600",
      bgColor: kpi.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      title: "Rentabilidad",
      value: `${formatNumber(kpi.profitability, 1)}%`,
      subtitle: "Sobre el costo total",
      icon: Percent,
      color: kpi.profitability >= 0 ? "text-green-700" : "text-red-600",
      bgColor: kpi.profitability >= 0 ? "bg-green-50" : "bg-red-50",
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
