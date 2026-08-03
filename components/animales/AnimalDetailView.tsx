"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { AnimalDetail } from "@/components/animales/types";
import { ACQUISITION_OPTIONS, STATUS_CONFIG } from "@/components/animales/types";
import { AnimalSaludSection } from "@/modules/salud/client";

const ACQUISITION_LABEL: Record<string, string> = Object.fromEntries(
  ACQUISITION_OPTIONS.map((o) => [o.value, o.label])
);

type Props = {
  detail: AnimalDetail;
};

export function AnimalDetailView({ detail }: Props) {
  const status = STATUS_CONFIG[detail.status];
  const purchase = detail.purchase;
  const sale = detail.sale;
  const margin = detail.margin;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            {detail.tagId}
          </p>
          <p className="text-base text-muted-foreground mt-1.5 sm:text-lg">
            {detail.breed} · {detail.sex === "M" ? "Macho" : "Hembra"}
            {detail.age ? ` · ${detail.age} meses` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={status.variant} className="text-sm px-2.5 py-0.5">
            {status.label}
          </Badge>
          {detail.moduleId && (
            <Badge variant="outline" className="font-mono text-sm px-2.5 py-0.5">
              Corral {detail.moduleId}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 xl:gap-10">
        <div className="space-y-5">
          <Section title="Datos de inventario">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Info label="Ingreso" value={formatDate(detail.entryDate)} />
              <Info label="Peso inicial" value={`${detail.initialWeight} kg`} />
              <Info label="Peso actual" value={`${detail.currentWeight} kg`} />
              <Info label="Ganancia" value={`+${detail.metrics.gainKg} kg`} highlight="gain" />
              <Info label="ADG" value={`${detail.metrics.adg} kg/día`} />
              <Info label="Días engorda" value={String(detail.metrics.daysInFeedlot)} />
              <Info label="Corral" value={detail.moduleId || "—"} />
              <Info label="Edad" value={detail.age ? `${detail.age} meses` : "—"} />
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          {purchase && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
              <p className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">
                Compra / adquisición
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Info
                  label="Origen"
                  value={ACQUISITION_LABEL[purchase.acquisitionType] ?? purchase.acquisitionType}
                  variant="emerald"
                />
                <Info label="Fecha compra" value={formatDate(purchase.purchaseDate)} variant="emerald" />
                <Info
                  label="Precio/kg compra"
                  value={formatCurrency(purchase.pricePerKg)}
                  variant="emerald"
                  highlight="money"
                />
                <Info
                  label="Costo total"
                  value={formatCurrency(purchase.totalCost)}
                  variant="emerald"
                  highlight="money"
                />
                <Info
                  label="Peso compra"
                  value={`${purchase.purchaseWeightKg} kg`}
                  variant="emerald"
                />
                {purchase.folio && <Info label="Folio" value={purchase.folio} variant="emerald" />}
                {purchase.auctionLotNumber && (
                  <Info label="Lote subasta" value={purchase.auctionLotNumber} variant="emerald" />
                )}
              </div>
            </div>
          )}

          {sale && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
              <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">
                Venta registrada
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Info label="Fecha" value={formatDate(sale.saleDate)} variant="blue" />
                <Info label="Comprador" value={sale.buyer} variant="blue" className="sm:col-span-2" />
                <Info label="Peso salida" value={`${sale.pesoSalidaKg} kg`} variant="blue" />
                <Info
                  label="Precio/kg venta"
                  value={formatCurrency(sale.pricePerKg)}
                  variant="blue"
                  highlight="money"
                />
                <Info
                  label="Total venta"
                  value={formatCurrency(sale.totalRevenue)}
                  variant="blue"
                  highlight="money"
                />
              </div>
            </div>
          )}

          {purchase && sale && margin && (
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                margin.total >= 0
                  ? "border-green-200 bg-green-50/40"
                  : "border-red-200 bg-red-50/40"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                {margin.total >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-700" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-700" />
                )}
                Comparación compra vs venta
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Info
                  label="Δ Precio/kg"
                  value={`${margin.perKg >= 0 ? "+" : ""}${formatCurrency(margin.perKg)}/kg`}
                  variant={margin.total >= 0 ? "green" : "red"}
                  highlight={margin.perKg >= 0 ? "gain" : "loss"}
                />
                <Info
                  label="Utilidad bruta"
                  value={`${margin.total >= 0 ? "+" : ""}${formatCurrency(margin.total)}`}
                  variant={margin.total >= 0 ? "green" : "red"}
                  highlight={margin.total >= 0 ? "gain" : "loss"}
                />
                {margin.pct != null && (
                  <Info
                    label="Margen %"
                    value={`${margin.pct >= 0 ? "+" : ""}${margin.pct}%`}
                    variant={margin.total >= 0 ? "green" : "red"}
                    highlight={margin.pct >= 0 ? "gain" : "loss"}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                Compra: {formatCurrency(purchase.pricePerKg)}/kg ({formatCurrency(purchase.totalCost)})
                {" → "}
                Venta: {formatCurrency(sale.pricePerKg)}/kg ({formatCurrency(sale.totalRevenue)})
              </p>
            </div>
          )}

          {!purchase && !sale && (
            <div className="rounded-xl border border-dashed p-10 text-center text-base text-muted-foreground">
              Sin datos de compra o venta vinculados.
            </div>
          )}
        </div>
      </div>

      <AnimalSaludSection animalId={detail.id} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

function Info({
  label,
  value,
  variant = "default",
  highlight,
  className = "",
}: {
  label: string;
  value: string;
  variant?: "default" | "emerald" | "blue" | "green" | "red";
  highlight?: "gain" | "loss" | "money";
  className?: string;
}) {
  const bg =
    variant === "emerald"
      ? "bg-white/70 border-emerald-100"
      : variant === "blue"
        ? "bg-white/70 border-blue-100"
        : variant === "green"
          ? "bg-white/60 border-green-100"
          : variant === "red"
            ? "bg-white/60 border-red-100"
            : "bg-muted/20";

  const valueClass =
    highlight === "gain"
      ? "text-emerald-700 text-lg"
      : highlight === "loss"
        ? "text-red-700 text-lg"
        : highlight === "money"
          ? "font-semibold tabular-nums text-lg"
          : "text-base";

  return (
    <div className={`rounded-lg border p-3 min-w-0 ${bg} ${className}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      <p className={`font-medium mt-1 break-words ${valueClass}`}>{value}</p>
    </div>
  );
}
