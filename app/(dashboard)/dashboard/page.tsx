import DashboardCards from "@/components/DashboardCards";
import ChartWeight from "@/components/ChartWeight";
import ChartCosts from "@/components/ChartCosts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { animals, sales, healthAlerts, kpiSummary } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, Beef, ShoppingCart, Activity } from "lucide-react";

const alertTypeConfig = {
  urgente: { variant: "destructive" as const, icon: "🔴" },
  programado: { variant: "info" as const, icon: "🔵" },
  revisión: { variant: "secondary" as const, icon: "⚪" },
  tratamiento: { variant: "warning" as const, icon: "🟡" },
};

export default function DashboardPage() {
  const recentAnimals = animals.slice(0, 5);
  const recentSales = sales.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen general del ciclo de engorda
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-foreground">{kpiSummary.activeAnimals}</span>
          <span>animales activos</span>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardCards />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWeight />
        <ChartCosts />
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent animals */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Beef className="h-4 w-4 text-emerald-600" />
                Animales Recientes
              </CardTitle>
              <a href="/animals" className="text-xs text-primary hover:underline">Ver todos</a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentAnimals.map((animal) => (
                <div key={animal.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-semibold font-mono">{animal.tagId}</p>
                    <p className="text-xs text-muted-foreground">{animal.breed} – {animal.moduleId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{animal.currentWeight} kg</p>
                    <p className="text-xs text-emerald-600">+{animal.currentWeight - animal.initialWeight} kg</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Health alerts */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas Activas
              </CardTitle>
              <a href="/health" className="text-xs text-primary hover:underline">Ver todas</a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {healthAlerts.map((alert) => {
                const config = alertTypeConfig[alert.type];
                return (
                  <div key={alert.id} className="flex items-start gap-2.5 py-1.5 border-b last:border-0">
                    <span className="text-sm mt-0.5">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(alert.dueDate)}</p>
                    </div>
                    <Badge variant={config.variant} className="text-[10px] shrink-0">
                      {alert.priority}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Ventas Recientes
              </CardTitle>
              <a href="/sales" className="text-xs text-primary hover:underline">Ver todas</a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-semibold font-mono">{sale.tagId}</p>
                    <p className="text-xs text-muted-foreground">{sale.breed} – {formatDate(sale.saleDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">{formatCurrency(sale.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">{sale.finalWeight} kg @ ${sale.pricePerKg}/kg</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
