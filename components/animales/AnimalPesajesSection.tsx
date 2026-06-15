"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import { Scale } from "lucide-react";
import type { AnimalDetail } from "@/components/animales/types";
import {
  buildPesajeMetrics,
  formatAdg,
  formatGainKg,
} from "@/lib/api/pesaje-metrics";

type Props = {
  detail: Pick<
    AnimalDetail,
    "entryDate" | "initialWeight" | "currentWeight" | "metrics" | "pesajes"
  >;
  compact?: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  rutina: "Rutina",
  venta: "Venta",
  sanitario: "Sanitario",
};

export function AnimalPesajesSection({ detail, compact = false }: Props) {
  const [expanded, setExpanded] = useState(true);

  const rows = useMemo(
    () => buildPesajeMetrics(detail.pesajes, detail.entryDate, detail.initialWeight),
    [detail.pesajes, detail.entryDate, detail.initialWeight]
  );

  const showBaseline = rows.length === 0;

  return (
    <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:px-6 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Scale className="h-5 w-5 text-violet-600 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Historial de pesajes</h2>
            <p className="text-sm text-muted-foreground">
              Control de ganancia por período — estilo hoja de cálculo
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 text-xs sm:text-sm">
          <p className="font-semibold text-emerald-700 tabular-nums">
            +{detail.metrics.gainKg} kg total
          </p>
          <p className="text-muted-foreground tabular-nums">
            {detail.metrics.adg} kg/día · {detail.metrics.daysInFeedlot} días en finca
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#f3f3f3] border-b border-[#d4d4d4] text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Th className="w-10 text-center">#</Th>
                  <Th>Fecha</Th>
                  <Th className="text-right">Peso (kg)</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right bg-emerald-50/80">Δ kg período</Th>
                  <Th className="text-right bg-emerald-50/80">Días período</Th>
                  <Th className="text-right bg-emerald-50/80">ADG período</Th>
                  <Th className="text-right bg-blue-50/80">Días en finca</Th>
                  <Th className="text-right bg-blue-50/80">Ganancia acum.</Th>
                  <Th className="text-right bg-blue-50/80">ADG acum.</Th>
                </tr>
              </thead>
              <tbody>
                {showBaseline ? (
                  <tr className="border-b border-[#e5e5e5] bg-white hover:bg-[#fafafa]">
                    <Td className="text-center text-muted-foreground">1</Td>
                    <Td>{formatDate(detail.entryDate)}</Td>
                    <Td num className="font-semibold">
                      {detail.initialWeight}
                    </Td>
                    <Td>
                      <TipoBadge tipo="ingreso" />
                    </Td>
                    <Td num muted>
                      —
                    </Td>
                    <Td num muted>
                      —
                    </Td>
                    <Td num muted>
                      —
                    </Td>
                    <Td num>0</Td>
                    <Td num muted>
                      0
                    </Td>
                    <Td num muted>
                      —
                    </Td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#e5e5e5] hover:bg-[#f5f9ff] ${
                        index % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                      }`}
                    >
                      <Td className="text-center text-muted-foreground">{index + 1}</Td>
                      <Td>{formatDate(row.fecha)}</Td>
                      <Td num className="font-semibold">
                        {row.pesoKg}
                      </Td>
                      <Td>
                        <TipoBadge tipo={row.tipo} />
                      </Td>
                      <Td num gain={row.gainPeriodKg}>
                        {formatGainKg(row.gainPeriodKg)}
                      </Td>
                      <Td num>{row.periodDays}</Td>
                      <Td num gain={row.adgPeriod ?? undefined}>
                        {formatAdg(row.adgPeriod)}
                      </Td>
                      <Td num>{row.daysInFarm}</Td>
                      <Td num gain={row.gainTotalKg}>
                        {formatGainKg(row.gainTotalKg)}
                      </Td>
                      <Td num gain={row.adgTotal ?? undefined}>
                        {formatAdg(row.adgTotal)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
              {!showBaseline && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-medium">
                    <Td colSpan={2} className="text-xs uppercase tracking-wide text-indigo-900">
                      Actual / resumen
                    </Td>
                    <Td num className="font-bold text-indigo-950">
                      {detail.currentWeight}
                    </Td>
                    <Td>—</Td>
                    <Td num className="text-emerald-800">
                      {rows.length > 0
                        ? formatGainKg(rows[rows.length - 1].gainPeriodKg)
                        : "—"}
                    </Td>
                    <Td num>
                      {rows.length > 0 ? rows[rows.length - 1].periodDays : "—"}
                    </Td>
                    <Td num className="text-emerald-800">
                      {rows.length > 0 ? formatAdg(rows[rows.length - 1].adgPeriod) : "—"}
                    </Td>
                    <Td num className="text-blue-900">
                      {detail.metrics.daysInFeedlot}
                    </Td>
                    <Td num className="font-bold text-emerald-800">
                      +{detail.metrics.gainKg}
                    </Td>
                    <Td num className="font-bold text-blue-900">
                      {detail.metrics.adg}
                    </Td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!compact && (
            <div className="px-5 py-3 sm:px-6 bg-muted/20 border-t text-xs text-muted-foreground grid sm:grid-cols-3 gap-2">
              <p>
                <span className="font-medium text-foreground">Δ kg período:</span> ganancia vs
                pesaje anterior (o peso inicial).
              </p>
              <p>
                <span className="font-medium text-foreground">ADG período:</span> kg ganados por día
                en ese intervalo.
              </p>
              <p>
                <span className="font-medium text-foreground">Días en finca:</span> tiempo desde
                ingreso ({formatDate(detail.entryDate)}).
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 font-semibold border-r border-[#e0e0e0] last:border-r-0 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  num,
  gain,
  muted,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  num?: boolean;
  gain?: number;
  muted?: boolean;
  colSpan?: number;
}) {
  const gainClass =
    gain != null
      ? gain > 0
        ? "text-emerald-700 font-medium"
        : gain < 0
          ? "text-red-600 font-medium"
          : "text-muted-foreground"
      : "";

  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 border-r border-[#ebebeb] last:border-r-0 whitespace-nowrap ${
        num ? "text-right tabular-nums" : ""
      } ${muted ? "text-muted-foreground" : ""} ${gainClass} ${className}`}
    >
      {children}
    </td>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const label = TIPO_LABEL[tipo] ?? tipo;
  const styles =
    tipo === "ingreso"
      ? "bg-violet-100 text-violet-800"
      : tipo === "venta"
        ? "bg-blue-100 text-blue-800"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${styles}`}>
      {label}
    </span>
  );
}
