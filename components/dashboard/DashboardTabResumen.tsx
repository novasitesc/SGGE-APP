"use client";

import ChartWeight from "@/components/ChartWeight";
import ChartCosts from "@/components/ChartCosts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatModuleLabel } from "@/lib/modulos/constants";
import type {
  Animal,
  CostByCategory,
  HealthAlert,
  Sale,
  WeightRecord,
} from "@/lib/types/domain";
import { AlertTriangle, Beef, ShoppingCart } from "lucide-react";

const alertTypeConfig = {
  urgente: { variant: "destructive" as const, icon: "🔴" },
  programado: { variant: "info" as const, icon: "🔵" },
  revisión: { variant: "secondary" as const, icon: "⚪" },
  tratamiento: { variant: "warning" as const, icon: "🟡" },
  carencia: { variant: "warning" as const, icon: "🟠" },
};

type Props = {
  weightHistory: WeightRecord[];
  costsByCategory: CostByCategory[];
  recentAnimals: Animal[];
  healthAlerts: HealthAlert[];
  recentSales: Sale[];
  loadingDash?: boolean;
  loadingWeight?: boolean;
};

export default function DashboardTabResumen({
  weightHistory,
  costsByCategory,
  recentAnimals,
  healthAlerts,
  recentSales,
  loadingDash,
  loadingWeight,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWeight data={weightHistory} loading={loadingWeight} />
        <div className="space-y-2">
          <ChartCosts data={costsByCategory} loading={loadingDash} />
          <p className="text-[11px] text-muted-foreground px-1">
            Los gastos son de toda la granja y se comparten entre lotes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Beef className="h-4 w-4 text-emerald-600" />
                Animales Recientes
              </CardTitle>
              <a
                href="/gestion/animales"
                className="text-xs text-primary hover:underline"
              >
                Ver todos
              </a>
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
                  <div
                    key={animal.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold font-mono">
                        {animal.tagId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {animal.breed} –{" "}
                        {formatModuleLabel(animal.moduleId, animal.moduleName)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {animal.currentWeight} kg
                      </p>
                      <p className="text-xs text-emerald-600">
                        +{animal.currentWeight - animal.initialWeight} kg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas Activas
              </CardTitle>
              <a
                href="/gestion/salud"
                className="text-xs text-primary hover:underline"
              >
                Ver todas
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {healthAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay alertas activas.
              </p>
            ) : (
              <div className="space-y-2">
                {healthAlerts.map((alert) => {
                  const config = alertTypeConfig[alert.type];
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2.5 py-1.5 border-b last:border-0"
                    >
                      <span className="text-sm mt-0.5">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-snug">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDate(alert.dueDate)}
                        </p>
                      </div>
                      <Badge
                        variant={config.variant}
                        className="text-[10px] shrink-0"
                      >
                        {alert.priority}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Ventas Recientes
              </CardTitle>
              <a href="/sales" className="text-xs text-primary hover:underline">
                Ver todas
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin ventas recientes.
              </p>
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale) => {
                  const isInvoice = sale.source === "factura";
                  return (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between py-1.5 border-b last:border-0 gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold font-mono">
                          {isInvoice ? `Factura ${sale.tagId}` : sale.tagId}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isInvoice
                            ? `${sale.buyer} · ${formatDate(sale.saleDate)}`
                            : `${sale.breed} – ${formatDate(sale.saleDate)}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-green-700">
                          {formatCurrency(sale.totalRevenue)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sale.finalWeight > 0
                            ? `${sale.finalWeight} kg @ ${formatCurrency(sale.pricePerKg)}/kg`
                            : "Sin peso"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
