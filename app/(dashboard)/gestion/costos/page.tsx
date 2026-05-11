"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { CostCategory } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DollarSign, Plus, Pencil, Trash2, ChevronLeft, AlertTriangle, Search } from "lucide-react";

const categoryLabel: Record<CostCategory, string> = {
  transporte: "Transporte",
  alimentación: "Alimentación",
  vacunas: "Vacunas",
  mano_de_obra: "Mano de Obra",
  servicios: "Servicios",
  medicamentos: "Medicamentos",
  otros: "Otros",
};

const categoryColor: Record<CostCategory, string> = {
  transporte: "bg-orange-100 text-orange-700",
  alimentación: "bg-emerald-100 text-emerald-700",
  vacunas: "bg-purple-100 text-purple-700",
  mano_de_obra: "bg-blue-100 text-blue-700",
  servicios: "bg-cyan-100 text-cyan-700",
  medicamentos: "bg-red-100 text-red-700",
  otros: "bg-slate-100 text-slate-600",
};

const emptyForm = {
  category: "alimentación" as CostCategory,
  description: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  animalCount: "",
};

export default function GestionCostosPage() {
  const { costs, addCost, updateCost, removeCost } = useStore();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = costs.filter((c) => {
    const matchSearch = c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "todas" || c.category === filterCategory;
    return matchSearch && matchCat;
  });

  const totalAmount = costs.reduce((s, c) => s + c.amount, 0);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const cost = costs.find((c) => c.id === id);
    if (!cost) return;
    setEditingId(id);
    setForm({
      category: cost.category,
      description: cost.description,
      amount: String(cost.amount),
      date: cost.date,
      animalCount: cost.animalCount != null ? String(cost.animalCount) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ac = form.animalCount.trim();
    const payload = {
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
      animalCount: ac ? Number(ac) : undefined,
    };
    if (editingId) {
      updateCost(editingId, payload);
    } else {
      addCost(payload);
    }
    setDialogOpen(false);
  };

  const doDelete = () => {
    if (deleteId) removeCost(deleteId);
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
              <DollarSign className="h-5 w-5 text-orange-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Costos</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {costs.length} registros · Total: {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Costo
        </button>
      </div>

      {/* Category stats */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {(Object.keys(categoryLabel) as CostCategory[]).map((cat) => {
          const total = costs.filter((c) => c.category === cat).reduce((s, c) => s + c.amount, 0);
          return (
            <div key={cat} className={`rounded-xl border p-3 ${categoryColor[cat].replace("text-", "border-").replace("-700", "-200").replace("-600", "-200")} bg-white`}>
              <p className="text-xs font-medium text-muted-foreground">{categoryLabel[cat]}</p>
              <p className="text-sm font-bold mt-0.5">{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por descripción..."
                className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
              <option value="todas">Todas las categorías</option>
              {(Object.keys(categoryLabel) as CostCategory[]).map((cat) => (
                <option key={cat} value={cat}>{categoryLabel[cat]}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden md:table-cell">Animales</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron costos con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium text-sm">{cost.description}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${categoryColor[cost.category]}`}>
                        {categoryLabel[cost.category]}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(cost.date)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {cost.animalCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(cost.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cost.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(cost.id)}
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
            Mostrando {filtered.length} de {costs.length} registros
          </p>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              {editingId ? "Editar Costo" : "Nuevo Costo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cost-desc">Descripción *</Label>
              <Input
                id="cost-desc"
                placeholder="Maíz molido - Mayo"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cost-cat">Categoría</Label>
                <Select
                  id="cost-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as CostCategory })}
                >
                  {(Object.keys(categoryLabel) as CostCategory[]).map((cat) => (
                    <option key={cat} value={cat}>{categoryLabel[cat]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-amount">Monto ($) *</Label>
                <Input
                  id="cost-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cost-date">Fecha *</Label>
                <Input
                  id="cost-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-animals">No. animales (opcional)</Label>
                <Input
                  id="cost-animals"
                  type="number"
                  min="0"
                  placeholder="18"
                  value={form.animalCount}
                  onChange={(e) => setForm({ ...form, animalCount: e.target.value })}
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
                {editingId ? "Guardar cambios" : "Registrar costo"}
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
            ¿Seguro que deseas eliminar este costo? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={doDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
