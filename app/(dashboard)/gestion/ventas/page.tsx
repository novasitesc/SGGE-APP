"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShoppingCart, Plus, Pencil, Trash2, ChevronLeft, AlertTriangle, Search } from "lucide-react";

const emptyForm = {
  tagId: "",
  breed: "Angus",
  finalWeight: "",
  pricePerKg: "",
  saleDate: new Date().toISOString().split("T")[0],
  buyer: "",
  moduleId: "M1",
};

const breeds = ["Angus", "Simmental", "Brahman", "Charolais", "Hereford", "Brangus", "Simbrah", "Otra"];

export default function GestionVentasPage() {
  const { sales, modules, addSale, updateSale, removeSale } = useStore();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = sales.filter(
    (s) =>
      s.tagId.toLowerCase().includes(search.toLowerCase()) ||
      s.buyer.toLowerCase().includes(search.toLowerCase()) ||
      s.breed.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const avgPricePerKg =
    sales.length > 0 ? sales.reduce((s, v) => s + v.pricePerKg, 0) / sales.length : 0;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const sale = sales.find((s) => s.id === id);
    if (!sale) return;
    setEditingId(id);
    setForm({
      tagId: sale.tagId,
      breed: sale.breed,
      finalWeight: String(sale.finalWeight),
      pricePerKg: String(sale.pricePerKg),
      saleDate: sale.saleDate,
      buyer: sale.buyer,
      moduleId: sale.moduleId,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalWeight = Number(form.finalWeight);
    const pricePerKg = Number(form.pricePerKg);
    const payload = {
      tagId: form.tagId,
      breed: form.breed,
      finalWeight,
      pricePerKg,
      totalRevenue: finalWeight * pricePerKg,
      saleDate: form.saleDate,
      buyer: form.buyer,
      moduleId: form.moduleId,
    };
    if (editingId) {
      updateSale(editingId, payload);
    } else {
      addSale(payload);
    }
    setDialogOpen(false);
  };

  const doDelete = () => {
    if (deleteId) removeSale(deleteId);
    setDeleteId(null);
  };

  const moduleIds = modules.map((m) => m.id);

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
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Ventas</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {sales.length} ventas registradas
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Venta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200">
          <p className="text-2xl font-bold">{sales.length}</p>
          <p className="text-sm font-medium mt-0.5">Ventas totales</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 text-emerald-700 border-emerald-200 col-span-1 md:col-span-2">
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
          <p className="text-sm font-medium mt-0.5">Ingresos totales</p>
        </div>
        <div className="rounded-xl border p-4 bg-violet-50 text-violet-700 border-violet-200">
          <p className="text-2xl font-bold tabular-nums">
            {avgPricePerKg > 0 ? formatCurrency(avgPricePerKg) : "—"}
          </p>
          <p className="text-sm font-medium mt-0.5">Precio prom. $/kg</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por arete, raza o comprador..."
              className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Arete</TableHead>
                <TableHead>Raza</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead className="hidden md:table-cell">Peso Final</TableHead>
                <TableHead className="hidden md:table-cell">$/kg</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron ventas.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono font-semibold text-xs">{sale.tagId}</TableCell>
                    <TableCell>{sale.breed}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(sale.saleDate)}</TableCell>
                    <TableCell className="text-sm">{sale.buyer}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{sale.finalWeight} kg</TableCell>
                    <TableCell className="hidden md:table-cell text-sm tabular-nums">{formatCurrency(sale.pricePerKg)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(sale.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(sale.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(sale.id)}
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
          <p className="text-xs text-muted-foreground mt-3">
            Mostrando {filtered.length} de {sales.length} ventas
          </p>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              {editingId ? "Editar Venta" : "Nueva Venta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-tag">Arete *</Label>
                <Input
                  id="sale-tag"
                  placeholder="BV-021"
                  value={form.tagId}
                  onChange={(e) => setForm({ ...form, tagId: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-breed">Raza</Label>
                <Select
                  id="sale-breed"
                  value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                >
                  {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-weight">Peso final (kg) *</Label>
                <Input
                  id="sale-weight"
                  type="number"
                  min="0"
                  placeholder="420"
                  value={form.finalWeight}
                  onChange={(e) => setForm({ ...form, finalWeight: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-price">Precio ($/kg) *</Label>
                <Input
                  id="sale-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="48.50"
                  value={form.pricePerKg}
                  onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })}
                  required
                />
              </div>
            </div>
            {form.finalWeight && form.pricePerKg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total calculado: </span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(Number(form.finalWeight) * Number(form.pricePerKg))}
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sale-buyer">Comprador *</Label>
              <Input
                id="sale-buyer"
                placeholder="Rastro Municipal Norte"
                value={form.buyer}
                onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-date">Fecha de venta *</Label>
                <Input
                  id="sale-date"
                  type="date"
                  value={form.saleDate}
                  onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-module">Módulo</Label>
                <Select
                  id="sale-module"
                  value={form.moduleId}
                  onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
                >
                  {moduleIds.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
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
                {editingId ? "Guardar cambios" : "Registrar venta"}
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
            ¿Seguro que deseas eliminar esta venta? Esta acción no se puede deshacer.
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
