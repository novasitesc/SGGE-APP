"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createAlimentoApi,
  deleteAlimentoApi,
  fetchFeeding,
  updateAlimentoApi,
  updateCompraCantidadApi,
  type FeedPurchaseHistoryItem,
} from "@/lib/api/data-client";
import type { FeedType } from "@/lib/types/domain";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Wheat,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Package,
  FileText,
  CalendarDays,
  Scale,
  DollarSign,
} from "lucide-react";

const emptyForm = {
  name: "",
  unit: "kg",
  type: "concentrado",
  pricePerUnit: "",
};

type ProductCard = FeedType & {
  compras: FeedPurchaseHistoryItem[];
  compraCount: number;
  lastFecha: string | null;
  fromPdf: boolean;
};

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function GestionAlimentacionPage() {
  const { data: feeding, loading, reload } = useApiQuery(fetchFeeding);
  const feedTypes = feeding?.feedTypes ?? [];
  const purchaseHistory = feeding?.purchaseHistory ?? [];

  const products = useMemo<ProductCard[]>(() => {
    return feedTypes.map((feed) => {
      const compras = purchaseHistory
        .filter((p) => p.alimentoId === feed.id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      return {
        ...feed,
        compras,
        compraCount: compras.length,
        lastFecha: compras[0]?.fecha ?? null,
        fromPdf: compras.length > 0,
      };
    });
  }, [feedTypes, purchaseHistory]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = products.find((p) => p.id === selectedId) ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [qtyEditId, setQtyEditId] = useState<string | null>(null);
  const [qtyEditValue, setQtyEditValue] = useState("");
  const [qtySaving, setQtySaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const feed = feedTypes.find((f) => f.id === id);
    if (!feed) return;
    setEditingId(id);
    setForm({
      name: feed.name,
      unit: feed.unit,
      type: "concentrado",
      pricePerUnit: String(feed.pricePerUnit > 0 ? feed.pricePerUnit : ""),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const price = Number(form.pricePerUnit);
      if (!form.name.trim()) throw new Error("Nombre obligatorio.");
      if (Number.isNaN(price) || price < 0) throw new Error("Precio inválido.");

      if (editingId) {
        await updateAlimentoApi(editingId, {
          name: form.name.trim(),
          unit: form.unit.trim() || "kg",
          type: form.type.trim() || "concentrado",
          pricePerUnit: price,
        });
      } else {
        await createAlimentoApi({
          name: form.name.trim(),
          unit: form.unit.trim() || "kg",
          type: form.type.trim() || "concentrado",
          pricePerUnit: price,
        });
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await deleteAlimentoApi(deleteId);
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
              {products.length} producto{products.length !== 1 ? "s" : ""} en catálogo
              {purchaseHistory.length > 0
                ? ` · ${purchaseHistory.length} compra${purchaseHistory.length !== 1 ? "s" : ""} desde PDF`
                : ""}
              {" · "}
              <Link href="/feeding" className="text-primary underline-offset-2 hover:underline">
                Ver dashboard Alimentación
              </Link>
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {formError && !dialogOpen && deleteId === null && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {formError}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-lime-700" />
            Productos agregados
          </CardTitle>
          <CardDescription>
            Cada tarjeta es un insumo del catálogo. Selecciona uno para ver sus compras PDF y totales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Cargando productos…</p>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wheat className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No hay productos registrados</p>
              <p className="text-sm mt-1">
                Agrégalos manualmente o confirma comprobantes ALIM en{" "}
                <Link href="/gestion/comprobantes" className="underline underline-offset-2">
                  Comprobantes
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {products.map((product) => {
                const active = selectedId === product.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      setSelectedId((prev) => (prev === product.id ? null : product.id))
                    }
                    className={[
                      "text-left rounded-xl border p-4 transition-colors",
                      active
                        ? "border-lime-500 bg-lime-50/70 ring-1 ring-lime-500/30"
                        : "border-border hover:border-lime-300 hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.unit}
                          {product.pricePerUnit > 0
                            ? ` · ${formatCurrency(product.pricePerUnit)} / ${product.unit}`
                            : " · sin precio unitario"}
                        </p>
                      </div>
                      {product.fromPdf ? (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          PDF
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Catálogo
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Cantidad</p>
                        <p className="font-semibold tabular-nums">
                          {product.monthlyAmount > 0
                            ? product.monthlyAmount.toLocaleString("es-CR", {
                                maximumFractionDigits: 1,
                              })
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Costo</p>
                        <p className="font-semibold tabular-nums">
                          {product.monthlyCost > 0
                            ? formatCurrency(product.monthlyCost)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Compras</p>
                        <p className="font-semibold tabular-nums">{product.compraCount}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-lime-700" />
                  {selected.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  Detalle del producto · {selected.compraCount} compra
                  {selected.compraCount !== 1 ? "s" : ""}
                  {selected.lastFecha
                    ? ` · última ${formatFecha(selected.lastFecha)}`
                    : " · sin compras PDF aún"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(selected.id)}
                  className="p-2 rounded-lg border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setDeleteId(selected.id);
                  }}
                  className="p-2 rounded-lg border hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Precio / {selected.unit}
                </div>
                <p className="font-semibold tabular-nums">
                  {selected.pricePerUnit > 0
                    ? formatCurrency(selected.pricePerUnit)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Scale className="h-3.5 w-3.5" />
                  Cantidad total
                </div>
                <p className="font-semibold tabular-nums">
                  {selected.monthlyAmount > 0
                    ? `${selected.monthlyAmount.toLocaleString("es-CR", {
                        maximumFractionDigits: 2,
                      })} ${selected.unit}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Costo total
                </div>
                <p className="font-semibold tabular-nums text-emerald-700">
                  {selected.monthlyCost > 0
                    ? formatCurrency(selected.monthlyCost)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Última compra
                </div>
                <p className="font-semibold tabular-nums">
                  {selected.lastFecha ? formatFecha(selected.lastFecha) : "—"}
                </p>
              </div>
            </div>

            {selected.compras.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                Este producto está en catálogo, pero aún no tiene compras sincronizadas desde PDF.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Indica kg/und reales por factura para obtener ₡/kg. Si queda en
                  «compra», el promedio es ₡ por factura.
                </p>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                          Fecha
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">
                          Cantidad
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">
                          Costo
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                          Origen
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">
                          kg
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selected.compras.map((row) => {
                        const editing = qtyEditId === row.id;
                        const alimentacionId =
                          row.alimentacionId ?? row.id.split(":")[0];
                        return (
                          <tr key={row.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                              {formatFecha(row.fecha)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                              {row.cantidad.toLocaleString("es-CR", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              {row.unidad}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                              {formatCurrency(row.costo)}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <FileText className="h-3 w-3 shrink-0" />
                                {row.origen}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {editing ? (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    className="h-8 w-24 text-right"
                                    value={qtyEditValue}
                                    onChange={(e) => setQtyEditValue(e.target.value)}
                                    disabled={qtySaving}
                                  />
                                  <button
                                    type="button"
                                    disabled={qtySaving}
                                    className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                                    onClick={() => {
                                      void (async () => {
                                        const q = Number(qtyEditValue);
                                        if (!Number.isFinite(q) || q <= 0) {
                                          setFormError("Cantidad inválida.");
                                          return;
                                        }
                                        setQtySaving(true);
                                        setFormError(null);
                                        try {
                                          await updateCompraCantidadApi({
                                            alimentacionId,
                                            alimentoId: row.alimentoId,
                                            cantidad: q,
                                          });
                                          setQtyEditId(null);
                                          await reload();
                                        } catch (err) {
                                          setFormError(
                                            err instanceof Error
                                              ? err.message
                                              : "Error al guardar kg"
                                          );
                                        } finally {
                                          setQtySaving(false);
                                        }
                                      })();
                                    }}
                                  >
                                    {qtySaving ? "…" : "OK"}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-muted-foreground hover:underline"
                                    onClick={() => setQtyEditId(null)}
                                    disabled={qtySaving}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-primary hover:underline"
                                  onClick={() => {
                                    setQtyEditId(row.id);
                                    setQtyEditValue(
                                      row.unidad === "compra"
                                        ? ""
                                        : String(row.cantidad)
                                    );
                                  }}
                                >
                                  Editar kg
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Catálogo (lista)</CardTitle>
          <CardDescription>Edición rápida de todos los insumos</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Producto</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Precio/unidad</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay insumos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((feed) => (
                    <TableRow
                      key={feed.id}
                      className={selectedId === feed.id ? "bg-lime-50/50" : undefined}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedId(feed.id)}
                          className="font-medium text-left hover:underline underline-offset-2"
                        >
                          {feed.name}
                        </button>
                        {feed.fromPdf && (
                          <span className="ml-2 text-[10px] font-medium uppercase text-blue-700">
                            PDF
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{feed.unit}</TableCell>
                      <TableCell className="tabular-nums">
                        {feed.pricePerUnit > 0 ? formatCurrency(feed.pricePerUnit) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {feed.monthlyAmount > 0
                          ? feed.monthlyAmount.toLocaleString("es-CR", {
                              maximumFractionDigits: 1,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {feed.monthlyCost > 0 ? formatCurrency(feed.monthlyCost) : "—"}
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
                            onClick={() => {
                              setFormError(null);
                              setDeleteId(feed.id);
                            }}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-lime-600" />
              {editingId ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="feed-name">Nombre *</Label>
              <Input
                id="feed-name"
                placeholder="Concentrado engorda"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="feed-unit">Unidad *</Label>
                <Input
                  id="feed-unit"
                  placeholder="kg"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-type">Tipo</Label>
                <Input
                  id="feed-type"
                  placeholder="concentrado / forraje"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-price">Precio por unidad (₡) *</Label>
              <Input
                id="feed-price"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerUnit}
                onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                required
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Guardar" : "Agregar"}
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
            ¿Seguro que deseas eliminar este producto del catálogo?
          </p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <button
              onClick={() => setDeleteId(null)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void doDelete()}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
