"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTreatmentApi,
  fetchTreatments,
} from "@/lib/api/data-client";
import type { Treatment } from "@/lib/types/domain";
import { formatCurrency, formatDate } from "@/lib/utils";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import { Plus, Syringe } from "lucide-react";
import {
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPE_COLORS,
  type TreatmentType,
} from "@/modules/salud/types/salud.types";
import { TratamientoFormDialog } from "./TratamientoFormDialog";

type Props = {
  animalId: string;
};

export function AnimalSaludSection({ animalId }: Props) {
  const [rows, setRows] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTreatments({ animalId });
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [animalId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Syringe className="h-4 w-4 text-rose-700" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Historial sanitario
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Aplicar
        </button>
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
                  {t.fechaFinCarencia
                    ? ` · carencia hasta ${formatDate(t.fechaFinCarencia)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.fechaFinCarencia ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                      t.listoTraslado
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {t.listoTraslado ? "Listo traslado" : "En carencia"}
                  </span>
                ) : null}
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

      <TratamientoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultAnimalId={animalId}
        onSubmit={async (payload) => {
          await createTreatmentApi({
            type: payload.type,
            name: payload.name,
            date: payload.date,
            animalCount: 1,
            costPerAnimal: payload.costPerAnimal,
            totalCost: payload.totalCost ?? payload.costPerAnimal,
            appliedBy: payload.appliedBy,
            notes: payload.notes,
            nextDue: payload.nextDue,
            diasCarencia: payload.diasCarencia,
            animalId,
            animalIds: [animalId],
          });
          invalidateApiCacheMany(["treatments", "health-alerts", "dashboard"]);
          await reload();
        }}
      />
    </section>
  );
}
