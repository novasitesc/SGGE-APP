"use client";

import { useRef, useState } from "react";
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
import {
  confirmSaludImportApi,
  uploadSaludPdfApi,
} from "@/lib/api/data-client";
import {
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPES,
} from "@/modules/salud/types/salud.types";
import { FileUp, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function ImportPdfDialog({ open, onOpenChange, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [importId, setImportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "vacuna",
    date: new Date().toISOString().slice(0, 10),
    animalCount: "1",
    costPerAnimal: "0",
    totalCost: "",
    appliedBy: "",
    notes: "",
    nextDue: "",
  });

  const reset = () => {
    setStep("upload");
    setImportId(null);
    setError(null);
    setBusy(false);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const res = await uploadSaludPdfApi(file);
      const p = res.parsed ?? {};
      setImportId(res.id);
      setForm({
        name: String(p.name ?? ""),
        type: String(p.type ?? "vacuna"),
        date: String(p.date ?? new Date().toISOString().slice(0, 10)),
        animalCount: String(p.animalCount ?? 1),
        costPerAnimal: String(p.costPerAnimal ?? 0),
        totalCost: p.totalCost != null ? String(p.totalCost) : "",
        appliedBy: String(p.appliedBy ?? ""),
        notes: String(p.notes ?? "").slice(0, 300),
        nextDue: String(p.nextDue ?? ""),
      });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer PDF");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!importId) return;
    setBusy(true);
    setError(null);
    try {
      await confirmSaludImportApi(importId, {
        name: form.name,
        type: form.type,
        date: form.date,
        animalCount: Number(form.animalCount) || 1,
        costPerAnimal: Number(form.costPerAnimal) || 0,
        totalCost: form.totalCost ? Number(form.totalCost) : undefined,
        appliedBy: form.appliedBy,
        notes: form.notes,
        nextDue: form.nextDue || undefined,
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-sky-700" />
            Importar documento sanitario (PDF)
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Sube una receta, certificado o factura veterinaria. Revisarás los
              campos extraídos antes de inscribirlos en el dashboard.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="w-full border border-dashed rounded-2xl py-10 px-4 text-center hover:bg-muted/40 transition-colors"
            >
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <>
                  <FileUp className="h-6 w-6 mx-auto text-sky-700 mb-2" />
                  <span className="text-sm font-medium">Elegir PDF</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              Revisa y corrige los datos antes de confirmar.
            </p>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TREATMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TREATMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Animales</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.animalCount}
                  onChange={(e) =>
                    setForm({ ...form, animalCount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>₡/animal</Label>
                <Input
                  type="number"
                  value={form.costPerAnimal}
                  onChange={(e) =>
                    setForm({ ...form, costPerAnimal: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <Input
                  type="number"
                  value={form.totalCost}
                  onChange={(e) =>
                    setForm({ ...form, totalCost: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aplicado por</Label>
              <Input
                value={form.appliedBy}
                onChange={(e) =>
                  setForm({ ...form, appliedBy: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="px-4 py-2 rounded-xl border text-sm"
          >
            Cancelar
          </button>
          {step === "review" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar e inscribir
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
