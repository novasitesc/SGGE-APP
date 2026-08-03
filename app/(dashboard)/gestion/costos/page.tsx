"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCosts } from "@/lib/hooks/useCosts";
import type { CostCategory } from "@/lib/types/domain";
import {
  COST_CATEGORY_COLOR,
  COST_CATEGORY_LABEL,
  COST_FORM_CATEGORY_KEYS,
  costCategoryLabel,
  normalizeCostCategoryKey,
  type CostCategoryKey,
} from "@/lib/costs/categories";
import {
  filterCostsByRange,
  sumAmounts,
  totalsByCategoryKey,
} from "@/lib/costs/analytics";
import {
  COST_PERIOD_PRESET_LABEL,
  expandFetchRange,
  resolvePeriodRange,
  type CostPeriodPreset,
} from "@/lib/costs/period";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import {
  BarChart3,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Search,
  FileText,
} from "lucide-react";

const PAGE_SIZE = 25;

const emptyForm = {
  category: "alimentación" as CostCategory,
  description: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
};

export default function GestionCostosPage() {
  const [periodPreset, setPeriodPreset] = useState<CostPeriodPreset>("todo");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const periodRange = useMemo(
    () => resolvePeriodRange(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );
  const fetchRange = useMemo(
    () => expandFetchRange(periodRange),
    [periodRange]
  );

  const { costs, loading, error, mutating, addCost, updateCost, removeCost, setError } =
    useCosts({ from: fetchRange.from, to: fetchRange.to });

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [filterSource, setFilterSource] = useState<string>("todas");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const periodCosts = useMemo(
    () => filterCostsByRange(costs, periodRange),
    [costs, periodRange]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return periodCosts.filter((c) => {
      const matchSearch =
        !q ||
        c.description.toLowerCase().includes(q) ||
        (c.issuer ?? "").toLowerCase().includes(q) ||
        (c.fileName ?? "").toLowerCase().includes(q);
      const matchCat =
        filterCategory === "todas" ||
        normalizeCostCategoryKey(c.category) === filterCategory;
      const matchSource =
        filterSource === "todas" ||
        (filterSource === "comprobante" && c.source === "comprobante") ||
        (filterSource === "manual" && (c.source ?? "manual") === "manual");
      return matchSearch && matchCat && matchSource;
    });
  }, [periodCosts, search, filterCategory, filterSource]);

  const categoryTotals = useMemo(
    () => totalsByCategoryKey(periodCosts),
    [periodCosts]
  );
  const totalAmount = useMemo(() => sumAmounts(periodCosts), [periodCosts]);
  const fromInvoice = useMemo(
    () => periodCosts.filter((c) => c.source === "comprobante").length,
    [periodCosts]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const editingCost = editingId
    ? costs.find((c) => c.id === editingId) ?? null
    : null;
  const deleteCost = deleteId
    ? costs.find((c) => c.id === deleteId) ?? null
    : null;

  const resetPage = () => setPage(0);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const cost = costs.find((c) => c.id === id);
    if (!cost) return;
    const key = normalizeCostCategoryKey(cost.category);
    setEditingId(id);
    setForm({
      category: (key === "medicamentos" ? "vacunas" : key) as CostCategory,
      description: cost.description,
      amount: String(cost.amount),
      date: cost.date,
    });
    setFormError(null);
    setError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
    };
    try {
      if (editingId) {
        await updateCost(editingId, payload);
      } else {
        await addCost(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await removeCost(deleteId);
      setDeleteId(null);
    } catch {
      // error ya en hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              {periodCosts.length} registros · {fromInvoice} desde factura · Total:{" "}
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/costs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Ver análisis
          </Link>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Costo
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {COST_FORM_CATEGORY_KEYS.map((cat) => {
          const total = categoryTotals.get(cat) ?? 0;
          return (
            <div
              key={cat}
              className="rounded-xl border p-3 bg-white border-slate-200"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {COST_CATEGORY_LABEL[cat]}
              </p>
              <p className="text-sm font-bold mt-0.5">{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={periodPreset}
                onChange={(e) => {
                  setPeriodPreset(e.target.value as CostPeriodPreset);
                  resetPage();
                }}
                className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
              >
                {(Object.keys(COST_PERIOD_PRESET_LABEL) as CostPeriodPreset[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {COST_PERIOD_PRESET_LABEL[key]}
                    </option>
                  )
                )}
              </select>
              {periodPreset === "custom" && (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      resetPage();
                    }}
                    className="px-3 py-2 text-sm rounded-xl border bg-background"
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      resetPage();
                    }}
                    className="px-3 py-2 text-sm rounded-xl border bg-background"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por descripción, emisor o archivo…"
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPage();
                  }}
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  resetPage();
                }}
                className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
              >
                <option value="todas">Todas las categorías</option>
                {COST_FORM_CATEGORY_KEYS.map((cat) => (
                  <option key={cat} value={cat}>
                    {COST_CATEGORY_LABEL[cat]}
                  </option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={(e) => {
                  setFilterSource(e.target.value);
                  resetPage();
                }}
                className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
              >
                <option value="todas">Todos los orígenes</option>
                <option value="comprobante">Desde factura</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Descripción</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando costos…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron costos con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((cost) => {
                  const catKey = normalizeCostCategoryKey(cost.category) as CostCategoryKey;
                  const displayKey =
                    catKey === "medicamentos" ? "vacunas" : catKey;
                  return (
                    <TableRow key={cost.id}>
                      <TableCell className="text-sm">
                        <p className="font-medium">{cost.description}</p>
                        {cost.issuer && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Emisor: {cost.issuer}
                          </p>
                        )}
                        {cost.fileName && (
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[220px]"
                            title={cost.fileName}
                          >
                            {cost.fileName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {cost.source === "comprobante" ? (
                          <Badge variant="info" className="gap-1">
                            <FileText className="h-3 w-3" />
                            Desde factura
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-lg font-medium ${COST_CATEGORY_COLOR[displayKey]}`}
                        >
                          {costCategoryLabel(cost.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(cost.date)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(cost.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cost.comprobanteId && (
                            <Link
                              href="/gestion/comprobantes"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Ver en Comprobantes"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Link>
                          )}
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
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Mostrando{" "}
              {filtered.length === 0
                ? 0
                : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}`}{" "}
              de {filtered.length} (periodo: {periodCosts.length})
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              {editingId ? "Editar Costo" : "Nuevo Costo"}
            </DialogTitle>
          </DialogHeader>
          {editingCost?.source === "comprobante" && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Este gasto proviene de una factura. Los cambios no modifican el
              comprobante original.
            </p>
          )}
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
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as CostCategory })
                  }
                >
                  {COST_FORM_CATEGORY_KEYS.map((cat) => (
                    <option key={cat} value={cat}>
                      {COST_CATEGORY_LABEL[cat]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-amount">Monto (₡) *</Label>
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
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter>
              <button
                type="button"
                disabled={mutating}
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {mutating
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Registrar costo"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
          {deleteCost?.source === "comprobante" && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Al eliminar se liberará el enlace con la factura asociada. El
              comprobante permanecerá en el módulo de Comprobantes.
            </p>
          )}
          <DialogFooter>
            <button
              disabled={mutating}
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={mutating}
              onClick={doDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {mutating ? "Eliminando…" : "Eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
