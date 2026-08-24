"use client";

import type { ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartSalud } from "@/modules/salud/client";
import type { SaludKpis } from "@/modules/salud/types/salud.types";
import type { HealthAlert } from "@/lib/types/domain";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Activity,
  Syringe,
  Receipt,
} from "lucide-react";

const alertTypeConfig = {
  urgente: { variant: "destructive" as const, icon: "🔴" },
  programado: { variant: "info" as const, icon: "🔵" },
  revisión: { variant: "secondary" as const, icon: "⚪" },
  tratamiento: { variant: "warning" as const, icon: "🟡" },
  carencia: { variant: "warning" as const, icon: "🟠" },
};

type Props = {
  kpis: SaludKpis | null;
  healthAlerts: HealthAlert[];
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

export default function DashboardTabSanidad({
  kpis,
  healthAlerts,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tratamientos y alertas sanitarias del período cargado.
        </p>
        <a
          href="/gestion/salud"
          className="text-xs text-primary hover:underline"
        >
          Ver salud
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat
          label="Tratamientos"
          value={String(kpis?.treatmentsCount ?? 0)}
          icon={Activity}
          color="text-teal-700"
        />
        <MiniStat
          label="Alertas altas"
          value={String(kpis?.activeAlertsHigh ?? 0)}
          icon={AlertTriangle}
          color="text-red-700"
        />
        <MiniStat
          label="Vacunas"
          value={String(kpis?.vaccinesApplied ?? 0)}
          icon={Syringe}
          color="text-blue-700"
        />
        <MiniStat
          label="Costo sanitario"
          value={formatCurrency(kpis?.totalCost ?? 0)}
          icon={Receipt}
          color="text-violet-700"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tendencia y costos</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSalud
            trend={kpis?.trendByMonth ?? []}
            costByType={kpis?.costByType ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas activas
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {healthAlerts.length} · altas:{" "}
              {formatNumber(kpis?.activeAlertsHigh ?? 0, 0)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {healthAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay alertas activas.
            </p>
          ) : (
            <div className="space-y-2">
              {healthAlerts.slice(0, 8).map((alert) => {
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
                        {alert.tagId ? ` · ${alert.tagId}` : ""}
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
    </div>
  );
}
