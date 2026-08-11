"use client";

import { useCallback } from "react";
import DashboardCards from "@/components/DashboardCards";
import ChartWeight from "@/components/ChartWeight";
import ChartCosts from "@/components/ChartCosts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatModuleLabel } from "@/lib/modulos/constants";
import { AlertTriangle, Beef, ShoppingCart, Activity } from "lucide-react";
import { fetchDashboard, fetchWeightHistory } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import { loteLabel } from "@/lib/lotes/active-lote";

const alertTypeConfig = {
  urgente: { variant: "destructive" as const, icon: "🔴" },
  programado: { variant: "info" as const, icon: "🔵" },
  revisión: { variant: "secondary" as const, icon: "⚪" },
  tratamiento: { variant: "warning" as const, icon: "🟡" },
  carencia: { variant: "warning" as const, icon: "🟠" },
};

export default function DashboardPage() {
  const { loteId, lote } = useActiveLote();
  const dashLoader = useCallback(() => fetchDashboard(loteId), [loteId]);
  const weightLoader = useCallback(() => fetchWeightHistory(loteId), [loteId]);

  const { data: dashboard, loading: loadingDash } = useApiQuery(
    loteId ? `dashboard:${loteId}` : "dashboard",
    dashLoader,
    [loteId],
    { enabled: !!loteId }
  );
  const { data: weightHistory, loading: loadingWeight } = useApiQuery(
    loteId ? `weights:history:${loteId}` : "weights:history",
    weightLoader,
    [loteId],
    { enabled: !!loteId }
  );

  const kpi = dashboard?.kpiSummary;
  const recentAnimals = dashboard?.recentAnimals ?? [];
  const recentSales = dashboard?.recentSales ?? [];
  const healthAlerts = dashboard?.healthAlerts ?? [];
  const costsByCategory = dashboard?.costsByCategory ?? [];
  const loteName = loteLabel(lote);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estadísticas de animales del lote{" "}
            <span className="font-medium text-foreground">{loteName}</span>
            {" · "}
            gastos compartidos de la granja
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-foreground">{kpi?.activeAnimals ?? 0}</span>
          <span>animales activos</span>
        </div>
      </div>

      <DashboardCards kpi={kpi} loading={loadingDash} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWeight data={weightHistory ?? []} loading={loadingWeight} />
        <div className="space-y-2">
          <ChartCosts data={costsByCategory} loading={loadingDash} />
          <p className="text-[11px] text-muted-foreground px-1">
            Los gastos son de toda la granja y se comparten entre lotes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Beef className="h-4 w-4 text-emerald-600" />
                Animales Recientes
              </CardTitle>
              <a href="/gestion/animales" className="text-xs text-primary hover:underline">Ver todos</a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingDash ? (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded" />
                ))}
              </div>
            ) : recentAnimals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin animales en este lote. Un lote nuevo empieza sin inventario.
              </p>
            ) : (
              <div className="space-y-2">
                {recentAnimals.map((animal) => (
                  <div key={animal.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-semibold font-mono">{animal.tagId}</p>
                      <p className="text-xs text-muted-foreground">
                        {animal.breed} – {formatModuleLabel(animal.moduleId, animal.moduleName)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{animal.currentWeight} kg</p>
                      <p className="text-xs text-emerald-600">+{animal.currentWeight - animal.initialWeight} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas Activas
              </CardTitle>
              <a href="/gestion/salud" className="text-xs text-primary hover:underline">Ver todas</a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {healthAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay alertas activas.</p>
            ) : (
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
            )}
          </CardContent>
        </Card>

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
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin ventas de este lote.
              </p>
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-semibold font-mono">{sale.tagId}</p>
                      <p className="text-xs text-muted-foreground">{sale.breed} – {formatDate(sale.saleDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">{formatCurrency(sale.totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">{sale.finalWeight} kg @ {formatCurrency(sale.pricePerKg)}/kg</p>
                    </div>
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
