"use client";

import { Grid3X3, Loader2 } from "lucide-react";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import { loteLabel } from "@/lib/lotes/active-lote";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LoteSelector({ className, compact }: Props) {
  const { lotes, loteId, loading, setLoteId } = useActiveLote();

  if (loading && lotes.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {!compact && <span>Lotes…</span>}
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5",
          className
        )}
        title="Cree un lote en Administración"
      >
        <Grid3X3 className="h-3.5 w-3.5" />
        Sin lotes
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border bg-muted/40 px-2 py-1",
        className
      )}
    >
      <Grid3X3 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
      {!compact && (
        <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
          Lote
        </span>
      )}
      <select
        value={loteId ?? ""}
        onChange={(e) => setLoteId(e.target.value)}
        className="max-w-[11rem] sm:max-w-[14rem] bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
        aria-label="Lote de engorda activo"
        title="Las estadísticas de animales se segmentan por este lote. Gastos y catálogos son de toda la granja."
      >
        {lotes.map((l) => (
          <option key={l.id} value={l.id}>
            {loteLabel(l)}
            {l.estado === "cerrado" ? " (cerrado)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
