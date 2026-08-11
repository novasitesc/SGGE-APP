"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedType } from "@/lib/types/domain";
import { createFeedingDeliveryApi } from "@/lib/api/data-client";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Wheat } from "lucide-react";
import { useActiveLote } from "@/components/lotes/LoteProvider";

type LoteOpt = { id: string; nombre: string };

type SuggestedPortion = {
  alimentoId: string;
  /** kg totales del hato para un día (reparto equitativo). */
  kgHatoDia: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedTypes: FeedType[];
  animalCount: number;
  lotes?: LoteOpt[];
  lastDelivery?: {
    fecha: string;
    lines: { alimentoId: string; cantidad: number }[];
  } | null;
  onSuccess: () => void;
  /** Prefill lines when duplicating an existing delivery */
  duplicateLines?: { alimentoId: string; cantidad: number }[] | null;
  /** Sugerencias equitativas desde PDF / raciones previas. */
  suggestedPortions?: SuggestedPortion[];
};

const MAX_KG_PER_ANIMAL_WARN = 25;

export function RegistrarEntregaDialog({
  open,
  onOpenChange,
  feedTypes,
  animalCount,
  lotes = [],
  lastDelivery,
  onSuccess,
  duplicateLines,
  suggestedPortions = [],
}: Props) {
  const { loteId: activeLoteId } = useActiveLote();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [loteId, setLoteId] = useState("");
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [herdTotal, setHerdTotal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const preferredLoteId = () => {
    if (activeLoteId && lotes.some((l) => l.id === activeLoteId)) {
      return activeLoteId;
    }
    return lotes[0]?.id ?? "";
  };

  const reset = () => {
    setFecha(new Date().toISOString().slice(0, 10));
    setObservaciones("");
    setQtyById({});
    setHerdTotal("");
    setError(null);
    setWarn(null);
    setLoteId(preferredLoteId());
  };

  useEffect(() => {
    if (open) {
      setLoteId((prev) => {
        if (prev && lotes.some((l) => l.id === prev)) return prev;
        return preferredLoteId();
      });
      if (duplicateLines?.length) {
        const next: Record<string, string> = {};
        for (const l of duplicateLines) {
          next[l.alimentoId] = String(l.cantidad);
        }
        setQtyById(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preferredLoteId uses activeLoteId/lotes
  }, [open, lotes, duplicateLines, activeLoteId]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const estimatedCost = useMemo(() => {
    return feedTypes.reduce((s, f) => {
      const q = Number(qtyById[f.id] ?? 0);
      if (!(q > 0)) return s;
      const unit =
        f.priceBasis === "unit" && f.pricePerUnit > 0
          ? f.pricePerUnit
          : f.pricePerUnit > 0 && f.pricePerUnit <= 5000
            ? f.pricePerUnit
            : 0;
      return s + q * unit;
    }, 0);
  }, [feedTypes, qtyById]);

  const totalKg = useMemo(
    () =>
      feedTypes.reduce((s, f) => {
        const q = Number(qtyById[f.id] ?? 0);
        return s + (q > 0 ? q : 0);
      }, 0),
    [feedTypes, qtyById]
  );

  const perAnimal = animalCount > 0 ? totalKg / animalCount : 0;

  const applyLastDelivery = () => {
    if (!lastDelivery?.lines?.length) {
      setError("No hay una entrega previa para copiar.");
      return;
    }
    const next: Record<string, string> = {};
    for (const l of lastDelivery.lines) {
      next[l.alimentoId] = String(l.cantidad);
    }
    setQtyById(next);
    setError(null);
    setWarn(`Copiado de entrega ${lastDelivery.fecha}.`);
  };

  const applyHerdSplit = () => {
    const total = Number(herdTotal);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Indica kg totales del hato > 0.");
      return;
    }
    const active = feedTypes.filter((f) => Number(qtyById[f.id] ?? 0) > 0);
    if (active.length === 0) {
      const target = feedTypes[0];
      if (!target) return;
      setQtyById({ [target.id]: String(Math.round(total * 1000) / 1000) });
    } else {
      // Partes iguales entre insumos activos (y luego entre animales).
      const each = Math.round((total / active.length) * 1000) / 1000;
      const next = { ...qtyById };
      for (const f of active) {
        next[f.id] = String(each);
      }
      setQtyById(next);
    }
    const perHead =
      animalCount > 0
        ? (Math.round((total / animalCount) * 1000) / 1000).toFixed(2)
        : "—";
    setError(null);
    setWarn(
      `Reparto equitativo: ${total} kg del hato → ${perHead} kg/animal (${animalCount || 0} cab.).`
    );
  };

  const applySuggestedPortions = () => {
    const usable = suggestedPortions.filter((p) => p.kgHatoDia > 0);
    if (usable.length === 0) {
      setError(
        "No hay sugerencias desde PDF con kg. Captura kg en Compras o copia la última entrega."
      );
      return;
    }
    const next: Record<string, string> = {};
    for (const p of usable) {
      next[p.alimentoId] = String(Math.round(p.kgHatoDia * 1000) / 1000);
    }
    setQtyById(next);
    const total = usable.reduce((s, p) => s + p.kgHatoDia, 0);
    const perHead =
      animalCount > 0
        ? (Math.round((total / animalCount) * 1000) / 1000).toFixed(2)
        : "—";
    setError(null);
    setWarn(
      `Cargados ${usable.length} insumo(s) PDF en partes iguales: ${total.toLocaleString("es-CR")} kg hato/día ≈ ${perHead} kg/animal.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const lines = feedTypes
        .map((f) => ({
          alimentoId: f.id,
          cantidad: Number(qtyById[f.id] ?? 0),
        }))
        .filter((l) => l.cantidad > 0);

      if (lines.length === 0) {
        throw new Error("Indique cantidad en al menos un insumo.");
      }

      if (animalCount > 0 && perAnimal > MAX_KG_PER_ANIMAL_WARN) {
        setWarn(
          `Atención: ${perAnimal.toFixed(1)} kg/animal supera el umbral habitual (${MAX_KG_PER_ANIMAL_WARN}). Se guardará igual.`
        );
      }

      await createFeedingDeliveryApi({
        fecha,
        observaciones: observaciones.trim() || undefined,
        loteId: loteId || undefined,
        lines,
      });
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-emerald-700" />
            Registrar entrega de alimentación
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entrega-fecha">Fecha *</Label>
              <Input
                id="entrega-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entrega-lote">Lote destino</Label>
              <Select
                id="entrega-lote"
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
              >
                {lotes.length === 0 ? (
                  <option value="">Lote por defecto</option>
                ) : (
                  lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))
                )}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyLastDelivery}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted"
            >
              Copiar última entrega
            </button>
            <button
              type="button"
              onClick={applySuggestedPortions}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              Sugerir desde PDF (equitativo)
            </button>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="kg hato"
                className="h-8 w-24 text-xs"
                value={herdTotal}
                onChange={(e) => setHerdTotal(e.target.value)}
              />
              <button
                type="button"
                onClick={applyHerdSplit}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted"
              >
                Repartir equitativo
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Cantidades por insumo (kg totales del hato · se dividen en partes
              iguales entre {animalCount || "—"} animales)
            </Label>
            {feedTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay insumos en catálogo. Agréguelos en Gestión → Alimentación.
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border p-3 max-h-56 overflow-y-auto">
                {feedTypes.map((f) => {
                  const q = Number(qtyById[f.id] ?? 0);
                  const unitPrice =
                    f.priceBasis === "unit" && f.pricePerUnit > 0
                      ? f.pricePerUnit
                      : 0;
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_110px] gap-2 items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {unitPrice > 0
                            ? `${formatCurrency(unitPrice)}/${f.unit === "compra" ? "kg" : f.unit}`
                            : "Sin ₡/kg (usa promedio compra)"}
                          {q > 0 && unitPrice > 0
                            ? ` · ≈ ${formatCurrency(q * unitPrice)}`
                            : ""}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0 kg"
                        value={qtyById[f.id] ?? ""}
                        onChange={(e) =>
                          setQtyById((prev) => ({
                            ...prev,
                            [f.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs space-y-0.5">
            <p>
              Total hato:{" "}
              <strong>
                {totalKg.toLocaleString("es-CR", { maximumFractionDigits: 2 })}{" "}
                kg
              </strong>
            </p>
            <p>
              Porción equitativa:{" "}
              <strong className="text-emerald-700">
                {animalCount > 0
                  ? `${perAnimal.toFixed(2)} kg/animal`
                  : "—"}
              </strong>
              {animalCount > 0 ? ` × ${animalCount} animales` : ""}
            </p>
            <p>
              Costo estimado:{" "}
              <strong className="text-emerald-700">
                {estimatedCost > 0 ? formatCurrency(estimatedCost) : "—"}
              </strong>
              {estimatedCost <= 0 && totalKg > 0
                ? " (falta ₡/kg en catálogo)"
                : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entrega-obs">Observaciones</Label>
            <textarea
              id="entrega-obs"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-xl border bg-background px-3 py-2"
              placeholder="Opcional"
            />
          </div>

          {warn && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {warn}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || feedTypes.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar entrega
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
