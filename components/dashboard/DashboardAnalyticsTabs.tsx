"use client";

import { useCallback, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchFinancialReports,
  fetchModules,
  fetchFeeding,
  fetchTreatments,
} from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { computeSaludKpis } from "@/modules/salud/client";
import type {
  CostByCategory,
  DashboardData,
  HealthAlert,
  KpiSummary,
  WeightRecord,
} from "@/lib/types/domain";
import type { SaludKpis } from "@/modules/salud/types/salud.types";
import DashboardTabResumen from "./DashboardTabResumen";
import DashboardTabOperativo from "./DashboardTabOperativo";
import DashboardTabFinanciero from "./DashboardTabFinanciero";
import DashboardTabAlimentacion from "./DashboardTabAlimentacion";
import DashboardTabSanidad from "./DashboardTabSanidad";

type TabId =
  | "resumen"
  | "operativo"
  | "financiero"
  | "alimentacion"
  | "sanidad";

type Props = {
  loteId: string | null;
  dashboard: DashboardData | null;
  weightHistory: WeightRecord[];
  loadingDash?: boolean;
  loadingWeight?: boolean;
};

export default function DashboardAnalyticsTabs({
  loteId,
  dashboard,
  weightHistory,
  loadingDash,
  loadingWeight,
}: Props) {
  const [tab, setTab] = useState<TabId>("resumen");

  const kpi: KpiSummary | null = dashboard?.kpiSummary ?? null;
  const costsByCategory: CostByCategory[] = dashboard?.costsByCategory ?? [];
  const recentAnimals = dashboard?.recentAnimals ?? [];
  const recentSales = dashboard?.recentSales ?? [];
  const invoiceSales = dashboard?.invoiceSales ?? [];
  const healthAlerts: HealthAlert[] = dashboard?.healthAlerts ?? [];

  const modulesLoader = useCallback(() => fetchModules(loteId), [loteId]);
  const { data: modulesData, loading: loadingModules } = useApiQuery(
    loteId ? `modules:dash:${loteId}` : "modules:dash",
    modulesLoader,
    [loteId],
    { enabled: !!loteId && tab === "operativo" }
  );

  const { data: financials, loading: loadingFin } = useApiQuery(
    "reports:financial",
    fetchFinancialReports,
    [],
    { enabled: tab === "financiero" }
  );

  const feedingLoader = useCallback(() => fetchFeeding(30, loteId), [loteId]);
  const { data: feeding, loading: loadingFeed } = useApiQuery(
    loteId ? `feeding:dash:30:${loteId}` : "feeding:dash:30",
    feedingLoader,
    [loteId],
    { enabled: !!loteId && tab === "alimentacion" }
  );

  const { data: treatments, loading: loadingTreatments } = useApiQuery(
    "treatments:dash",
    fetchTreatments,
    [],
    { enabled: tab === "sanidad" }
  );

  const saludKpis: SaludKpis | null = useMemo(() => {
    if (!treatments) return null;
    const base = computeSaludKpis(treatments);
    const activeAlertsHigh = healthAlerts.filter(
      (a) => a.priority === "alta"
    ).length;
    return { ...base, activeAlertsHigh };
  }, [treatments, healthAlerts]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabId)}
      className="space-y-4"
    >
      <TabsList className="w-full flex flex-wrap h-auto gap-1 justify-start">
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="operativo">Operativo</TabsTrigger>
        <TabsTrigger value="financiero">Financiero</TabsTrigger>
        <TabsTrigger value="alimentacion">Alimentación</TabsTrigger>
        <TabsTrigger value="sanidad">Sanidad</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className="mt-4">
        <DashboardTabResumen
          weightHistory={weightHistory}
          costsByCategory={costsByCategory}
          recentAnimals={recentAnimals}
          healthAlerts={healthAlerts}
          recentSales={recentSales}
          loadingDash={loadingDash}
          loadingWeight={loadingWeight}
        />
      </TabsContent>

      <TabsContent value="operativo" className="mt-4">
        <DashboardTabOperativo
          kpi={kpi}
          weightHistory={weightHistory}
          modules={modulesData ?? []}
          loadingWeight={loadingWeight}
          loadingModules={loadingModules}
        />
      </TabsContent>

      <TabsContent value="financiero" className="mt-4">
        <DashboardTabFinanciero
          kpi={kpi}
          financials={financials ?? []}
          costsByCategory={costsByCategory}
          invoiceSales={invoiceSales}
          loadingFin={loadingFin}
          loadingDash={loadingDash}
        />
      </TabsContent>

      <TabsContent value="alimentacion" className="mt-4">
        <DashboardTabAlimentacion
          feeding={feeding}
          feedCostApproxPerDay={kpi?.feedCostApproxPerDay}
          loading={loadingFeed}
        />
      </TabsContent>

      <TabsContent value="sanidad" className="mt-4">
        <DashboardTabSanidad
          kpis={saludKpis}
          healthAlerts={healthAlerts}
          loading={loadingTreatments}
        />
      </TabsContent>
    </Tabs>
  );
}
