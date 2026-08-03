"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2, Syringe } from "lucide-react";
import type { Treatment } from "@/lib/types/domain";
import {
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPES,
  type TreatmentType,
} from "@/modules/salud/types/salud.types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Treatment | null;
  onSubmit: (payload: {
    type: string;
    name: string;
    date: string;
    animalCount: number;
    costPerAnimal: number;
    totalCost: number;
    appliedBy: string;
    notes: string;
    nextDue?: string;
  }) => Promise<void>;
};

const empty = {
  type: "vacuna" as TreatmentType,
  name: "",
  date: new Date().toISOString().split("T")[0],
  animalCount: "1",
  costPerAnimal: "",
  totalCost: "",
  appliedBy: "",
  notes: "",
  nextDue: "",
};

export function TratamientoFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        type: (editing.type as TreatmentType) || "vacuna",
        name: editing.name,
        date: editing.date,
        animalCount: String(editing.animalCount),
        costPerAnimal: String(editing.costPerAnimal),
        totalCost: String(editing.totalCost),
        appliedBy: editing.appliedBy,
        notes: editing.notes,
        nextDue: editing.nextDue ?? "",
      });
    } else {
      setForm(empty);
    }
    setError(null);
  }, [open, editing]);

  const computedTotal = useMemo(() => {
    const n = Number(form.animalCount) || 0;
    const c = Number(form.costPerAnimal) || 0;
    return Math.round(n * c * 100) / 100;
  }, [form.animalCount, form.costPerAnimal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const animalCount = Number(form.animalCount) || 1;
      const costPerAnimal = Number(form.costPerAnimal) || 0;
      const totalCost = form.totalCost
        ? Number(form.totalCost)
        : computedTotal;
      await onSubmit({
        type: form.type,
        name: form.name.trim(),
        date: form.date,
        animalCount,
        costPerAnimal,
        totalCost,
        appliedBy: form.appliedBy.trim(),
        notes: form.notes.trim(),
        nextDue: form.nextDue || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-rose-700" />
            {editing ? "Editar tratamiento" : "Nuevo tratamiento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Nombre / medicamento *</Label>
            <Input
              id="t-name"
              placeholder="Vacuna Triple Viral"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-type">Tipo</Label>
              <Select
                id="t-type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as TreatmentType })
                }
              >
                {TREATMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TREATMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Fecha *</Label>
              <Input
                id="t-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-count">Animales</Label>
              <Input
                id="t-count"
                type="number"
                min="1"
                value={form.animalCount}
                onChange={(e) =>
                  setForm({ ...form, animalCount: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-cpa">₡/animal</Label>
              <Input
                id="t-cpa"
                type="number"
                min="0"
                step="0.01"
                value={form.costPerAnimal}
                onChange={(e) =>
                  setForm({ ...form, costPerAnimal: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-total">Total (₡)</Label>
              <Input
                id="t-total"
                type="number"
                min="0"
                step="0.01"
                placeholder={String(computedTotal || "")}
                value={form.totalCost}
                onChange={(e) =>
                  setForm({ ...form, totalCost: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-by">Aplicado por</Label>
            <Input
              id="t-by"
              placeholder="Dr. Hernández"
              value={form.appliedBy}
              onChange={(e) => setForm({ ...form, appliedBy: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notas</Label>
            <Input
              id="t-notes"
              placeholder="Observaciones"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-next">Próxima aplicación</Label>
            <Input
              id="t-next"
              type="date"
              value={form.nextDue}
              onChange={(e) => setForm({ ...form, nextDue: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Si se indica, se genera una alerta sanitaria automática.
            </p>
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Registrar"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
