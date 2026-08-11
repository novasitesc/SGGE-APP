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
import type { Animal, Treatment } from "@/lib/types/domain";
import { fetchAnimals, fetchCorrales } from "@/lib/api/animals-client";
import { addDaysIso } from "@/modules/salud/lib/carencia";
import {
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPES,
  type TreatmentType,
} from "@/modules/salud/types/salud.types";

export type DestinoTratamiento = "hato" | "modulo" | "animales";

export type TratamientoFormPayload = {
  type: string;
  name: string;
  date: string;
  animalCount: number;
  costPerAnimal: number;
  totalCost: number;
  appliedBy: string;
  notes: string;
  nextDue?: string;
  diasCarencia?: number;
  animalId?: string;
  animalIds?: string[];
  destino: DestinoTratamiento;
  moduleId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Treatment | null;
  /** Prefija destino en un animal (ficha animal). */
  defaultAnimalId?: string;
  /** Prefija destino en un módulo. */
  defaultModuleId?: string;
  onSubmit: (payload: TratamientoFormPayload) => Promise<void>;
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
  diasCarencia: "",
  destino: "modulo" as DestinoTratamiento,
  moduleId: "",
  animalSearch: "",
};

function isSelectableAnimal(a: Animal): boolean {
  return a.status === "activo" || a.status === "enfermo";
}

export function TratamientoFormDialog({
  open,
  onOpenChange,
  editing,
  defaultAnimalId,
  defaultModuleId,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(empty);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [modules, setModules] = useState<{ id: string; name: string }[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingOpts(true);
    void Promise.all([fetchAnimals(), fetchCorrales()])
      .then(([a, m]) => {
        if (cancelled) return;
        setAnimals(a.filter(isSelectableAnimal));
        setModules(m);
      })
      .catch(() => {
        if (!cancelled) {
          setAnimals([]);
          setModules([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOpts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
        diasCarencia:
          editing.diasCarencia != null ? String(editing.diasCarencia) : "",
        destino: editing.animalId ? "animales" : "hato",
        moduleId: "",
        animalSearch: "",
      });
      setSelectedIds(editing.animalId ? [editing.animalId] : []);
    } else if (defaultAnimalId) {
      setForm({
        ...empty,
        destino: "animales",
      });
      setSelectedIds([defaultAnimalId]);
    } else if (defaultModuleId) {
      setForm({
        ...empty,
        destino: "modulo",
        moduleId: defaultModuleId,
      });
      setSelectedIds([]);
    } else {
      setForm(empty);
      setSelectedIds([]);
    }
    setError(null);
  }, [open, editing, defaultAnimalId, defaultModuleId]);

  const moduleAnimals = useMemo(() => {
    if (!form.moduleId) return [];
    return animals.filter((a) => a.moduleId === form.moduleId);
  }, [animals, form.moduleId]);

  // Al elegir/cambiar módulo, preselecciona todos sus animales (una sola vez).
  useEffect(() => {
    if (form.destino !== "modulo" || !form.moduleId) return;
    setSelectedIds(
      animals.filter((a) => a.moduleId === form.moduleId).map((a) => a.id)
    );
  }, [form.destino, form.moduleId, animals]);

  const filteredAnimals = useMemo(() => {
    const q = form.animalSearch.trim().toLowerCase();
    if (!q) return animals;
    return animals.filter(
      (a) =>
        a.tagId.toLowerCase().includes(q) ||
        a.moduleId.toLowerCase().includes(q) ||
        (a.moduleName ?? "").toLowerCase().includes(q) ||
        a.breed.toLowerCase().includes(q)
    );
  }, [animals, form.animalSearch]);

  const effectiveCount = useMemo(() => {
    if (form.destino === "hato") return Number(form.animalCount) || 1;
    return selectedIds.length || 0;
  }, [form.destino, form.animalCount, selectedIds]);

  const computedTotal = useMemo(() => {
    const n = effectiveCount;
    const c = Number(form.costPerAnimal) || 0;
    return Math.round(n * c * 100) / 100;
  }, [effectiveCount, form.costPerAnimal]);

  const previewFinCarencia = useMemo(() => {
    const dias = Number(form.diasCarencia);
    if (!form.date || !Number.isFinite(dias) || dias <= 0) return null;
    return addDaysIso(form.date, Math.floor(dias));
  }, [form.date, form.diasCarencia]);

  const toggleAnimal = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (form.destino === "modulo" && !form.moduleId) {
      setError("Selecciona un módulo.");
      return;
    }
    if (form.destino === "modulo" && selectedIds.length === 0) {
      setError("El módulo no tiene animales activos para aplicar.");
      return;
    }
    if (form.destino === "animales" && selectedIds.length === 0) {
      setError("Selecciona al menos un animal.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const animalCount = effectiveCount || 1;
      const costPerAnimal = Number(form.costPerAnimal) || 0;
      const totalCost = form.totalCost
        ? Number(form.totalCost)
        : computedTotal;
      const diasRaw = form.diasCarencia.trim();
      const diasCarencia =
        diasRaw === ""
          ? undefined
          : Math.max(0, Math.floor(Number(diasRaw) || 0));

      let notes = form.notes.trim();
      if (form.destino === "modulo" && form.moduleId) {
        const mod = modules.find((m) => m.id === form.moduleId);
        const label = mod ? `${mod.id} · ${mod.name}` : form.moduleId;
        const tag = `[módulo:${form.moduleId}]`;
        if (!notes.includes(tag)) {
          notes = notes ? `${notes} ${tag}` : `Aplicado en módulo ${label} ${tag}`;
        }
      }

      await onSubmit({
        type: form.type,
        name: form.name.trim(),
        date: form.date,
        animalCount,
        costPerAnimal,
        totalCost,
        appliedBy: form.appliedBy.trim(),
        notes,
        nextDue: form.nextDue || undefined,
        diasCarencia,
        destino: form.destino,
        moduleId: form.destino === "modulo" ? form.moduleId : undefined,
        animalId:
          form.destino !== "hato" && selectedIds.length === 1
            ? selectedIds[0]
            : undefined,
        animalIds:
          form.destino !== "hato" && selectedIds.length > 0
            ? selectedIds
            : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const lockedToAnimal = Boolean(defaultAnimalId && !editing);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {!editing && (
            <div className="space-y-2">
              <Label>Aplicar en</Label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl">
                {(
                  [
                    ["modulo", "Módulo"],
                    ["animales", "Animales"],
                    ["hato", "Hato"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={lockedToAnimal && id !== "animales"}
                    onClick={() => {
                      setForm({
                        ...form,
                        destino: id,
                        moduleId: id === "modulo" ? form.moduleId : "",
                        animalSearch: "",
                      });
                      if (id !== "modulo") setSelectedIds([]);
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                      form.destino === id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    } disabled:opacity-40`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {form.destino === "modulo" &&
                  "Elige el módulo y marca los animales a los que se aplica."}
                {form.destino === "animales" &&
                  "Busca y selecciona aretes de cualquier módulo."}
                {form.destino === "hato" &&
                  "Solo cantidad (sin amarrar aretes)."}
              </p>
            </div>
          )}

          {form.destino === "hato" && (
            <div className="space-y-1.5">
              <Label htmlFor="t-count">Cantidad de animales</Label>
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
          )}

          {form.destino === "modulo" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-module">Módulo / corral *</Label>
                <Select
                  id="t-module"
                  value={form.moduleId}
                  onChange={(e) =>
                    setForm({ ...form, moduleId: e.target.value })
                  }
                  disabled={loadingOpts}
                >
                  <option value="">Seleccionar módulo…</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} — {m.name}
                    </option>
                  ))}
                </Select>
              </div>

              {form.moduleId ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Animales del módulo · {selectedIds.length}/
                      {moduleAnimals.length} seleccionado
                      {selectedIds.length === 1 ? "" : "s"}
                    </span>
                    {moduleAnimals.length > 0 && (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() =>
                          setSelectedIds(
                            selectedIds.length === moduleAnimals.length
                              ? []
                              : moduleAnimals.map((a) => a.id)
                          )
                        }
                      >
                        {selectedIds.length === moduleAnimals.length
                          ? "Quitar todos"
                          : "Seleccionar todos"}
                      </button>
                    )}
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border divide-y">
                    {loadingOpts ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        Cargando animales…
                      </p>
                    ) : moduleAnimals.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        Este módulo no tiene animales activos.
                      </p>
                    ) : (
                      moduleAnimals.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded border"
                            checked={selectedIds.includes(a.id)}
                            onChange={() => toggleAnimal(a.id)}
                          />
                          <span className="font-mono font-medium">{a.tagId}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {a.breed}
                            {a.status === "enfermo" ? " · enfermo" : ""}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3">
                  Selecciona un módulo para ver su lista de animales.
                </p>
              )}
            </div>
          )}

          {form.destino === "animales" && (
            <div className="space-y-2">
              {!lockedToAnimal && (
                <>
                  <Label htmlFor="t-animal-search">Buscar arete</Label>
                  <Input
                    id="t-animal-search"
                    placeholder="Arete, raza o módulo…"
                    value={form.animalSearch}
                    onChange={(e) =>
                      setForm({ ...form, animalSearch: e.target.value })
                    }
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {selectedIds.length} seleccionado
                      {selectedIds.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        setSelectedIds(
                          selectedIds.length === filteredAnimals.length
                            ? []
                            : filteredAnimals.map((a) => a.id)
                        )
                      }
                    >
                      {selectedIds.length === filteredAnimals.length &&
                      filteredAnimals.length > 0
                        ? "Quitar todos"
                        : "Seleccionar visibles"}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border divide-y">
                    {loadingOpts ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        Cargando animales…
                      </p>
                    ) : filteredAnimals.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        Sin animales para mostrar.
                      </p>
                    ) : (
                      filteredAnimals.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded border"
                            checked={selectedIds.includes(a.id)}
                            onChange={() => toggleAnimal(a.id)}
                          />
                          <span className="font-mono font-medium">{a.tagId}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {a.moduleId}
                            {a.moduleName ? ` · ${a.moduleName}` : ""} · {a.breed}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
              {lockedToAnimal && (
                <p className="text-xs rounded-lg bg-muted px-3 py-2">
                  Se aplicará solo a este animal.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
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
              <p className="text-[11px] text-muted-foreground">
                {effectiveCount} animal{effectiveCount === 1 ? "" : "es"} × ₡
                {Number(form.costPerAnimal) || 0}
              </p>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-carencia">Días de carencia</Label>
              <Input
                id="t-carencia"
                type="number"
                min="0"
                placeholder="Manual de uso"
                value={form.diasCarencia}
                onChange={(e) =>
                  setForm({ ...form, diasCarencia: e.target.value })
                }
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
            </div>
          </div>
          {previewFinCarencia ? (
            <p className="text-xs rounded-lg bg-amber-50 text-amber-900 px-3 py-2">
              Listo para traslado/subasta a partir del{" "}
              <span className="font-semibold">{previewFinCarencia}</span>.
            </p>
          ) : null}
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
