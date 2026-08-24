"use client";

import ChartCosts from "@/components/ChartCosts";
import ChartFinancial from "@/components/ChartFinancial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type {
  CostByCategory,
  KpiSummary,
  MonthlyFinancial,
  Sale,
} from "@/lib/types/domain";
import { DollarSign, Receipt } from "lucide-react";

type Props = {
  kpi?: KpiSummary | null;
  financials: MonthlyFinancial[];
  costsByCategory: CostByCategory[];
  invoiceSales: Sale[];
  loadingFin?: boolean;
  loadingDash?: boolean;
};

export default function DashboardTabFinanciero({
  kpi,
  financials,
  costsByCategory,
  invoiceSales,
  loadingFin,
  loadingDash,
}: Props) {
  const rows = [
    {
      label: "Ingresos Totales",
      value: formatCurrency(kpi?.totalRevenue ?? 0),
      color: "text-green-700",
    },
    {
      label: "Costo Total",
      value: formatCurrency(kpi?.totalCost ?? 0),
      color: "text-red-700",
    },
    {
      label: "Utilidad Neta",
      value: formatCurrency(kpi?.netProfit ?? 0),
      color: (kpi?.netProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600",
    },
    {
      label: "Rentabilidad",
      value: `${formatNumber(kpi?.profitability ?? 0, 1)}%`,
      color: (kpi?.profitability ?? 0) >= 0 ? "text-green-700" : "text-red-600",
    },
    {
      label: "Costo por kg",
      value: formatCurrency(kpi?.costPerKg ?? 0),
      color: "text-amber-700",
    },
  ];

  const invoiceTotal = invoiceSales.reduce((s, v) => s + v.totalRevenue, 0);

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Gastos y facturas a nivel granja; KPIs de animales filtrados por el lote
        activo.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartFinancial data={financials} loading={loadingFin} />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Resumen financiero
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map(({ label, value, color }) => (
              <div
                key={label}
                className="flex justify-between items-center py-2 border-b last:border-0"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${color}`}>
                  {loadingDash ? "…" : value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-600" />
              Facturas de venta
            </CardTitle>
            <a href="/sales" className="text-xs text-primary hover:underline">
              Ver todas
            </a>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingDash ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted/30 rounded" />
              ))}
            </div>
          ) : invoiceSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin facturas de venta confirmadas.
            </p>
          ) : (
            <div className="space-y-2">
              {invoiceSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono">
                      Factura {sale.tagId}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sale.notes || sale.breed} · {formatDate(sale.saleDate)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sale.buyer}
                      {sale.finalWeight > 0
                        ? ` · ${formatNumber(sale.finalWeight, 1)} kg @ ${formatCurrency(sale.pricePerKg)}/kg`
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-700 shrink-0">
                    {formatCurrency(sale.totalRevenue)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  Total facturas
                </span>
                <span className="text-sm font-bold text-green-700">
                  {formatCurrency(invoiceTotal)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <ChartCosts data={costsByCategory} loading={loadingDash} />
        <p className="text-[11px] text-muted-foreground px-1">
          Distribución de costos compartidos de la granja.
        </p>
      </div>
    </div>
  );
}
