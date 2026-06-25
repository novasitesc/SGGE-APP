"use client";

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
import { Beef, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AnimalFormValues } from "@/components/animales/types";
import { ACQUISITION_OPTIONS } from "@/components/animales/types";
import type { AnimalStatus } from "@/lib/types/domain";
import { fetchRazas } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  form: AnimalFormValues;
  onChange: (form: AnimalFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string | null;
  corralIds: string[];
  lockArete?: boolean;
};

export function AnimalFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onChange,
  onSubmit,
  submitting,
  error,
  corralIds,
  lockArete = false,
}: Props) {
  const { data: breeds } = useApiQuery(fetchRazas);
  const breedList = breeds ?? [];
  const set = (partial: Partial<AnimalFormValues>) =>
    onChange({ ...form, ...partial });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beef className="h-5 w-5 text-emerald-600" />
            {mode === "create" ? "Registrar animal" : "Editar animal"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tagId">Arete *</Label>
              <Input
                id="tagId"
                placeholder="BV-021"
                value={form.tagId}
                onChange={(e) => set({ tagId: e.target.value })}
                required
                disabled={lockArete}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="breed">Raza *</Label>
              <Select
                id="breed"
                value={form.breed}
                onChange={(e) => set({ breed: e.target.value })}
              >
                {breedList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sex">Sexo</Label>
              <Select
                id="sex"
                value={form.sex}
                onChange={(e) => set({ sex: e.target.value as "M" | "H" })}
              >
                <option value="M">Macho</option>
                <option value="H">Hembra</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">Edad (meses)</Label>
              <Input
                id="age"
                type="number"
                min="0"
                placeholder="18"
                value={form.age}
                onChange={(e) => set({ age: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entryDate">Fecha de ingreso *</Label>
            <Input
              id="entryDate"
              type="date"
              value={form.entryDate}
              onChange={(e) => set({ entryDate: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="initialWeight">Peso inicial (kg) *</Label>
              <Input
                id="initialWeight"
                type="number"
                min="1"
                step="1"
                value={form.initialWeight}
                onChange={(e) => set({ initialWeight: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currentWeight">Peso actual (kg) *</Label>
              <Input
                id="currentWeight"
                type="number"
                min="1"
                step="1"
                value={form.currentWeight}
                onChange={(e) => set({ currentWeight: e.target.value })}
                required
              />
              {mode === "edit" && (
                <p className="text-[11px] text-muted-foreground">
                  Al cambiar el peso se registra un pesaje automático.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <p className="text-sm font-medium text-emerald-900">Datos de compra</p>
            <p className="text-[11px] text-emerald-800/80">
              {mode === "create"
                ? "Base para costeo y comparación con el precio de venta (₡/kg)."
                : "Datos de adquisición registrados al ingreso (solo lectura)."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acquisitionType">Origen</Label>
                <Select
                  id="acquisitionType"
                  value={form.acquisitionType}
                  disabled={mode === "edit"}
                  onChange={(e) =>
                    set({ acquisitionType: e.target.value as typeof form.acquisitionType })
                  }
                >
                  {ACQUISITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchasePricePerKg">Precio compra (₡/kg) *</Label>
                <Input
                  id="purchasePricePerKg"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="52.50"
                  value={form.purchasePricePerKg}
                  disabled={mode === "edit"}
                  onChange={(e) => set({ purchasePricePerKg: e.target.value })}
                  required={mode === "create"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invoiceFolio">Folio factura / remate</Label>
                <Input
                  id="invoiceFolio"
                  placeholder="410756"
                  value={form.invoiceFolio}
                  disabled={mode === "edit"}
                  onChange={(e) => set({ invoiceFolio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoiceOrAuctionDate">Fecha compra</Label>
                <Input
                  id="invoiceOrAuctionDate"
                  type="date"
                  value={form.invoiceOrAuctionDate}
                  disabled={mode === "edit"}
                  onChange={(e) => set({ invoiceOrAuctionDate: e.target.value })}
                />
              </div>
            </div>
            {form.acquisitionType === "subasta" && (
              <div className="space-y-1.5">
                <Label htmlFor="auctionLotNumber">Lote subasta</Label>
                <Input
                  id="auctionLotNumber"
                  placeholder="L-12"
                  value={form.auctionLotNumber}
                  disabled={mode === "edit"}
                  onChange={(e) => set({ auctionLotNumber: e.target.value })}
                />
              </div>
            )}
            {form.initialWeight && form.purchasePricePerKg && (
              <p className="text-[11px] text-muted-foreground">
                Costo total estimado al ingreso:{" "}
                {formatCurrency(
                  Number(form.initialWeight) * Number(form.purchasePricePerKg)
                )}{" "}
                ({form.initialWeight} kg × ₡{form.purchasePricePerKg}/kg)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="moduleId">Corral</Label>
              <Select
                id="moduleId"
                value={form.moduleId}
                onChange={(e) => set({ moduleId: e.target.value })}
              >
                {corralIds.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                value={form.status}
                onChange={(e) => set({ status: e.target.value as AnimalStatus })}
              >
                <option value="activo">Activo</option>
                <option value="enfermo">Enfermo</option>
                {mode === "edit" && <option value="vendido">Vendido</option>}
                <option value="muerto">Muerto (baja)</option>
              </Select>
              {mode === "create" && (
                <p className="text-[11px] text-muted-foreground">
                  Para dar de baja por venta, registre el animal y luego edítelo.
                </p>
              )}
            </div>
          </div>

          {mode === "edit" && form.status === "vendido" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900">Datos de venta</p>
              <p className="text-[11px] text-blue-700/80">
                Al guardar se registrará la venta y el animal pasará a resultados del
                dashboard.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="saleDate">Fecha de venta *</Label>
                  <Input
                    id="saleDate"
                    type="date"
                    value={form.saleDate}
                    onChange={(e) => set({ saleDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salePricePerKg">Precio (₡/kg) *</Label>
                  <Input
                    id="salePricePerKg"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="45.50"
                    value={form.salePricePerKg}
                    onChange={(e) => set({ salePricePerKg: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="saleBuyer">Comprador *</Label>
                <Input
                  id="saleBuyer"
                  placeholder="Frigorífico del Norte S.A."
                  value={form.saleBuyer}
                  onChange={(e) => set({ saleBuyer: e.target.value })}
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Peso de salida: {form.currentWeight || "—"} kg (peso actual)
                {form.currentWeight && form.salePricePerKg && (
                  <>
                    {" "}
                    · Total estimado:{" "}
                    {formatCurrency(
                      Number(form.currentWeight) * Number(form.salePricePerKg)
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Registrar" : "Guardar cambios"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
