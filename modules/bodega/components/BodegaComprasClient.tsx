"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronLeft,
  FileText,
  Leaf,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import {
  createBodegaCompraApi,
  deleteBodegaCompraApi,
  fetchBodegaCompras,
  updateBodegaCompraApi,
} from "@/lib/api/bodega-client";
import {
  BODEGA_LINEA_LABEL,
  BODEGA_LINEAS,
  BODEGA_UNIDADES,
  type BodegaLinea,
} from "@/modules/bodega";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  linea: "fertilizante" as BodegaLinea,
  fecha: today(),
  proveedor: "",
  producto: "",
  cantidad: "",
  unidad: "kg",
  monto: "",
  concepto: "",
};

type BodegaComprasClientProps = {
  /** `gestion`: sección editable del Centro de Gestión. `operacion`: dashboard de Operación. */
  variant: "gestion" | "operacion";
};

export function BodegaComprasClient({ variant }: BodegaComprasClientProps) {
  const { data, loading, error, mutate } = useApiQuery(
    "bodega",
    fetchBodegaCompras
  );
  const rows = data ?? [];
  const [lineaFilter, setLineaFilter] = useState<"todas" | BodegaLinea>("todas");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (lineaFilter !== "todas" && r.linea !== lineaFilter) return false;
      if (!q) return true;
      return (
        r.proveedor.toLowerCase().includes(q) ||
        r.producto.toLowerCase().includes(q) ||
        r.concepto.toLowerCase().includes(q) ||
        (r.fileName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, lineaFilter]);

  const total = rows.reduce((s, r) => s + r.monto, 0);
  const totalFert = rows
    .filter((r) => r.linea === "fertilizante")
    .reduce((s, r) => s + r.monto, 0);
  const totalHerb = rows
    .filter((r) => r.linea === "herbicida")
    .reduce((s, r) => s + r.monto, 0);
  const fromPdf = rows.filter((r) => r.origen === "comprobante").length;
  const pageError = dialogOpen || deleteId ? null : (error ?? formError);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      fecha: today(),
      linea: lineaFilter === "todas" ? "fertilizante" : lineaFilter,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setEditingId(id);
    setForm({
      linea: row.linea,
      fecha: row.fecha,
      proveedor: row.proveedor,
      producto: row.producto,
      cantidad: row.cantidad != null ? String(row.cantidad) : "",
      unidad: row.unidad,
      monto: String(row.monto),
      concepto: row.concepto,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const monto = Number(form.monto);
      if (!form.proveedor.trim()) throw new Error("Proveedor obligatorio.");
      if (!form.producto.trim()) throw new Error("Producto obligatorio.");
      if (!Number.isFinite(monto) || monto < 0) throw new Error("Monto inválido.");
      const cantidadRaw = form.cantidad.trim();
      const cantidad = cantidadRaw ? Number(cantidadRaw) : null;
      if (cantidadRaw && (!Number.isFinite(cantidad) || (cantidad ?? 0) <= 0)) {
        throw new Error("Cantidad debe ser mayor a 0.");
      }
      const payload = {
        linea: form.linea,
        fecha: form.fecha,
        proveedor: form.proveedor.trim(),
        producto: form.producto.trim(),
        cantidad,
        unidad: form.unidad,
        monto,
        concepto: form.concepto.trim() || undefined,
      };
      if (editingId) {
        const updated = await updateBodegaCompraApi(editingId, payload);
        mutate(rows.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createBodegaCompraApi(payload);
        mutate([created, ...rows]);
      }
      invalidateApiCacheMany(["bodega", "costs", "dashboard"]);
      setDialogOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBodegaCompraApi(deleteId);
      mutate(rows.filter((r) => r.id !== deleteId));
      invalidateApiCacheMany(["bodega", "costs", "dashboard"]);
      setDeleteId(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-6">
      {variant === "gestion" ? (
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
                <Warehouse className="h-5 w-5 text-lime-700" />
                <h1 className="text-2xl font-bold tracking-tight">Gestión de Bodega</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {rows.length} compra{rows.length !== 1 ? "s" : ""} · {fromPdf} desde
                factura · Total: {formatCurrency(total)}
                {" · "}
                <Link
                  href="/bodega"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Ver dashboard Bodega
                </Link>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/gestion/comprobantes"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4" />
              Subir factura PDF
            </Link>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva compra
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-lime-700" />
              <h1 className="text-2xl font-bold tracking-tight">Bodega</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Abono, fertilizantes y herbicidas · {fromPdf} desde factura
              {" · "}
              <Link
                href="/gestion/bodega"
                className="text-primary underline-offset-2 hover:underline"
              >
                Administrar en Gestión
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/gestion/comprobantes"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4" />
              Subir factura PDF
            </Link>
            <Link
              href="/gestion/bodega"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Gestionar
            </Link>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva compra
            </button>
          </div>
        </div>
      )}

      {pageError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {pageError}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total bodega</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatCurrency(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Abono y fertilizantes</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatCurrency(totalFert)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Herbicidas</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatCurrency(totalHerb)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Desde factura</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{fromPdf}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {rows.length} compra(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar producto, proveedor o PDF…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={lineaFilter}
              onChange={(e) =>
                setLineaFilter(e.target.value as "todas" | BodegaLinea)
              }
              className="sm:w-56"
            >
              <option value="todas">Todas las líneas</option>
              {BODEGA_LINEAS.map((linea) => (
                <option key={linea} value={linea}>
                  {BODEGA_LINEA_LABEL[linea]}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 animate-pulse bg-muted/30 rounded-xl" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay compras de bodega. Sube un PDF en Comprobantes y
              confírmalo como Abono y fertilizantes o Herbicidas, o registra
              una compra manual.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(row.fecha)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Leaf className="h-3 w-3" />
                        {BODEGA_LINEA_LABEL[row.linea]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{row.producto}</p>
                      <p className="text-xs text-muted-foreground">{row.concepto}</p>
                    </TableCell>
                    <TableCell className="text-sm">{row.proveedor}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {row.cantidad != null
                        ? `${row.cantidad} ${row.unidad}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {row.origen === "comprobante" ? (
                        <Badge variant="info" className="gap-1">
                          <FileText className="h-3 w-3" />
                          Factura
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(row.monto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.comprobanteId && (
                        <Link
                          href="/gestion/comprobantes"
                          className="p-1.5 rounded-lg hover:bg-muted inline-flex"
                          title={row.fileName ?? "Ver comprobante"}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-muted"
                        onClick={() => openEdit(row.id)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        onClick={() => setDeleteId(row.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar compra de bodega" : "Nueva compra de bodega"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Línea</Label>
              <Select
                value={form.linea}
                onChange={(e) =>
                  setForm({ ...form, linea: e.target.value as BodegaLinea })
                }
              >
                {BODEGA_LINEAS.map((linea) => (
                  <option key={linea} value={linea}>
                    {BODEGA_LINEA_LABEL[linea]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input
                placeholder="Agrocentro, El Colono…"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div>
              <Label>Producto</Label>
              <Input
                placeholder="Urea, glifosato, 10-30-10…"
                value={form.producto}
                onChange={(e) => setForm({ ...form, producto: e.target.value })}
              />
            </div>
            <div>
              <Label>Cantidad (opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </div>
            <div>
              <Label>Unidad</Label>
              <Select
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              >
                {BODEGA_UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Monto (₡)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Concepto (opcional)</Label>
              <Input
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <button
              type="button"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar compra</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se anula también el gasto en Costos. Si venía de un PDF, el
            comprobante queda libre para reclasificar.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="rounded-xl border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void doDelete()}
              className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-medium"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
