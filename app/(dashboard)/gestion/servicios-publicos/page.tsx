"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Search, Trash2, Zap } from "lucide-react";
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
  createServicioPublicoApi,
  deleteServicioPublicoApi,
  fetchServiciosPublicos,
  updateServicioPublicoApi,
} from "@/lib/api/obligaciones-client";
import {
  TIPO_SERVICIO_LABEL,
  TIPOS_SERVICIO_PUBLICO,
  type TipoServicioPublico,
} from "@/modules/obligaciones";
import { GestionObligacionLayout } from "@/modules/obligaciones/components/GestionObligacionLayout";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  tipo: "electricidad" as TipoServicioPublico,
  proveedor: "",
  numeroCuenta: "",
  periodoInicio: "",
  periodoFin: "",
  fechaPago: today(),
  monto: "",
  concepto: "",
};

export default function GestionServiciosPublicosPage() {
  const { data, loading, error, reload, mutate } = useApiQuery(
    "servicios-publicos",
    fetchServiciosPublicos
  );
  const rows = data ?? [];
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.proveedor.toLowerCase().includes(q) ||
        r.concepto.toLowerCase().includes(q) ||
        (r.numeroCuenta ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const total = rows.reduce((s, r) => s + r.monto, 0);
  const byTipo = TIPOS_SERVICIO_PUBLICO.map((tipo) => ({
    tipo,
    monto: rows.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.monto, 0),
  }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, fechaPago: today() });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setEditingId(id);
    setForm({
      tipo: row.tipo,
      proveedor: row.proveedor,
      numeroCuenta: row.numeroCuenta ?? "",
      periodoInicio: row.periodoInicio ?? "",
      periodoFin: row.periodoFin ?? "",
      fechaPago: row.fechaPago,
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
      const payload = {
        tipo: form.tipo,
        proveedor: form.proveedor.trim(),
        numeroCuenta: form.numeroCuenta.trim() || null,
        periodoInicio: form.periodoInicio || null,
        periodoFin: form.periodoFin || null,
        fechaPago: form.fechaPago,
        monto: Number(form.monto),
        concepto: form.concepto.trim() || null,
      };
      if (editingId) await updateServicioPublicoApi(editingId, payload);
      else await createServicioPublicoApi(payload);
      invalidateApiCacheMany(["servicios-publicos", "costs", "dashboard"]);
      await reload();
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
      await deleteServicioPublicoApi(deleteId);
      mutate(rows.filter((r) => r.id !== deleteId));
      invalidateApiCacheMany(["servicios-publicos", "costs", "dashboard"]);
      setDeleteId(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <GestionObligacionLayout
      title="Servicios públicos"
      description={`${rows.length} recibos · ICE, AyA, telecom e internet`}
      icon={Zap}
      iconClass="text-sky-700"
      error={error}
      onAdd={openAdd}
      addLabel="Nuevo recibo"
      kpis={[
        { label: "Total registrado", value: formatCurrency(total) },
        {
          label: "Electricidad",
          value: formatCurrency(byTipo.find((t) => t.tipo === "electricidad")?.monto ?? 0),
        },
        {
          label: "Agua",
          value: formatCurrency(byTipo.find((t) => t.tipo === "agua")?.monto ?? 0),
        },
        {
          label: "Telecom / internet",
          value: formatCurrency(
            (byTipo.find((t) => t.tipo === "telecomunicaciones")?.monto ?? 0) +
              (byTipo.find((t) => t.tipo === "internet")?.monto ?? 0)
          ),
        },
      ]}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background"
              placeholder="Buscar proveedor, NIS o concepto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>NIS / cuenta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No hay recibos de servicios públicos.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.proveedor}</p>
                      <p className="text-xs text-muted-foreground">{row.concepto}</p>
                    </TableCell>
                    <TableCell>{TIPO_SERVICIO_LABEL[row.tipo]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.numeroCuenta ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(row.fechaPago)}</TableCell>
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
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button type="button" className="p-1.5 rounded-lg hover:bg-muted" onClick={() => openEdit(row.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar recibo" : "Nuevo recibo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as TipoServicioPublico })
                }
              >
                {TIPOS_SERVICIO_PUBLICO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_SERVICIO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input
                placeholder="ICE, AyA, Kolbi…"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div>
              <Label>NIS / número de cuenta</Label>
              <Input
                value={form.numeroCuenta}
                onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={form.fechaPago}
                onChange={(e) => setForm({ ...form, fechaPago: e.target.value })}
              />
            </div>
            <div>
              <Label>Período desde</Label>
              <Input
                type="date"
                value={form.periodoInicio}
                onChange={(e) => setForm({ ...form, periodoInicio: e.target.value })}
              />
            </div>
            <div>
              <Label>Período hasta</Label>
              <Input
                type="date"
                value={form.periodoFin}
                onChange={(e) => setForm({ ...form, periodoFin: e.target.value })}
              />
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
              onClick={() => void save()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar recibo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            También se anula el gasto asociado en Costos.
          </p>
          <DialogFooter>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setDeleteId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void doDelete()}
              className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GestionObligacionLayout>
  );
}
