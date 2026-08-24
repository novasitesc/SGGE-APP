"use client";

import { useCallback } from "react";
import DashboardCards from "@/components/DashboardCards";
import DashboardAnalyticsTabs from "@/components/dashboard/DashboardAnalyticsTabs";
import { Activity } from "lucide-react";
import { fetchDashboard, fetchWeightHistory } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import { loteLabel } from "@/lib/lotes/active-lote";

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
            gastos y facturas compartidos de la granja
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-foreground">
            {kpi?.activeAnimals ?? 0}
          </span>
          <span>animales activos</span>
        </div>
      </div>

      <DashboardCards kpi={kpi} loading={loadingDash} />

      <DashboardAnalyticsTabs
        loteId={loteId}
        dashboard={dashboard}
        weightHistory={weightHistory ?? []}
        loadingDash={loadingDash}
        loadingWeight={loadingWeight}
      />
    </div>
  );
}
