"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Wheat, Plus, Pencil, Trash2, ChevronLeft, AlertTriangle } from "lucide-react";

const emptyForm = {
  name: "",
  unit: "kg",
  dailyConsumption: "",
  pricePerUnit: "",
  monthlyAmount: "",
  monthlyCost: "",
  percentage: "",
};

export default function GestionAlimentacionPage() {
  const { feedTypes, addFeedType, updateFeedType, removeFeedType } = useStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalMonthlyCost = feedTypes.reduce((s, f) => s + f.monthlyCost, 0);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const feed = feedTypes.find((f) => f.id === id);
    if (!feed) return;
    setEditingId(id);
    setForm({
      name: feed.name,
      unit: feed.unit,
      dailyConsumption: String(feed.dailyConsumption),
      pricePerUnit: String(feed.pricePerUnit),
      monthlyAmount: String(feed.monthlyAmount),
      monthlyCost: String(feed.monthlyCost),
      percentage: String(feed.percentage),
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      unit: form.unit,
      dailyConsumption: Number(form.dailyConsumption),
      pricePerUnit: Number(form.pricePerUnit),
      monthlyAmount: Number(form.monthlyAmount),
      monthlyCost: Number(form.monthlyCost),
      percentage: Number(form.percentage),
    };
    if (editingId) {
      updateFeedType(editingId, payload);
    } else {
      addFeedType(payload);
    }
    setDialogOpen(false);
  };

  const doDelete = () => {
    if (deleteId) removeFeedType(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/gestion"
            className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-lime-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Alimentación</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {feedTypes.length} insumos registrados · Costo mensual: {formatCurrency(totalMonthlyCost)}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Insumo
        </button>
      </div>

      {/* Porcentaje visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wheat className="h-4 w-4 text-lime-600" />
            Distribución del costo mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex rounded-xl overflow-hidden h-5 w-full">
            {feedTypes.map((f) => (
              <div
                key={f.id}
                title={`${f.name}: ${f.percentage}%`}
                style={{ width: `${f.percentage}%` }}
                className="transition-all"
                data-color={f.id}
              >
                <div
                  className="h-full"
                  style={{
                    backgroundColor: [
                      "#16a34a", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2",
                    ][feedTypes.indexOf(f) % 6],
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {feedTypes.map((f, i) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: [
                      "#16a34a", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2",
                    ][i % 6],
                  }}
                />
                <span className="text-xs text-muted-foreground">{f.name} <span className="font-medium text-foreground">{f.percentage}%</span></span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Insumo</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="hidden md:table-cell">Consumo/día/animal</TableHead>
                <TableHead className="hidden md:table-cell">Precio/unidad</TableHead>
                <TableHead className="hidden lg:table-cell">Cantidad mensual</TableHead>
                <TableHead>Costo mensual</TableHead>
                <TableHead className="hidden sm:table-cell">%</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay insumos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                feedTypes.map((feed) => (
                  <TableRow key={feed.id}>
                    <TableCell className="font-medium">{feed.name}</TableCell>
                    <TableCell className="text-muted-foreground">{feed.unit}</TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">{feed.dailyConsumption}</TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">{formatCurrency(feed.pricePerUnit)}</TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums">{feed.monthlyAmount} {feed.unit}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{formatCurrency(feed.monthlyCost)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs bg-lime-100 text-lime-700 px-2 py-0.5 rounded-lg font-medium">
                        {feed.percentage}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(feed.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(feed.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-lime-600" />
              {editingId ? "Editar Insumo" : "Nuevo Insumo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="feed-name">Nombre del insumo *</Label>
                <Input
                  id="feed-name"
                  placeholder="Maíz Molido"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-unit">Unidad *</Label>
                <Input
                  id="feed-unit"
                  placeholder="kg / lt / pza"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-daily">Consumo/día/animal</Label>
                <Input
                  id="feed-daily"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="6.5"
                  value={form.dailyConsumption}
                  onChange={(e) => setForm({ ...form, dailyConsumption: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-price">Precio por unidad ($)</Label>
                <Input
                  id="feed-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5.80"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-monthly-amt">Cantidad mensual</Label>
                <Input
                  id="feed-monthly-amt"
                  type="number"
                  min="0"
                  placeholder="3510"
                  value={form.monthlyAmount}
                  onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-monthly-cost">Costo mensual ($)</Label>
                <Input
                  id="feed-monthly-cost"
                  type="number"
                  min="0"
                  placeholder="20358"
                  value={form.monthlyCost}
                  onChange={(e) => setForm({ ...form, monthlyCost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-pct">Porcentaje (%)</Label>
                <Input
                  id="feed-pct"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="55"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {editingId ? "Guardar cambios" : "Agregar insumo"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas eliminar este insumo?
          </p>
          <DialogFooter>
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={doDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
