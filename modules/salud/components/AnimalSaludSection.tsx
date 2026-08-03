"use client";

import { useEffect, useState } from "react";
import { fetchTreatments } from "@/lib/api/data-client";
import type { Treatment } from "@/lib/types/domain";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Syringe } from "lucide-react";
import {
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPE_COLORS,
  type TreatmentType,
} from "@/modules/salud/types/salud.types";

type Props = {
  animalId: string;
};

export function AnimalSaludSection({ animalId }: Props) {
  const [rows, setRows] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTreatments({ animalId })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Syringe className="h-4 w-4 text-rose-700" />
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          Historial sanitario
        </h3>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-muted/40" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin tratamientos registrados para este animal.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(t.date)}
                  {t.nextDue ? ` · próxima ${formatDate(t.nextDue)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                    TREATMENT_TYPE_COLORS[t.type as TreatmentType] ??
                    "bg-muted text-foreground"
                  }`}
                >
                  {TREATMENT_TYPE_LABELS[t.type as TreatmentType] ?? t.type}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(t.totalCost)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
