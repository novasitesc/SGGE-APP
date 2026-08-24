"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileText, Pencil, Trash2 } from "lucide-react";
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
  createAporteCcssApi,
  deleteAporteCcssApi,
  fetchAportesCcss,
  updateAporteCcssApi,
} from "@/lib/api/obligaciones-client";
import {
  formatPeriodoLabel,
  TIPO_APORTE_CCSS_LABEL,
  TIPOS_APORTE_CCSS,
  type TipoAporteCcss,
} from "@/modules/obligaciones";
import { GestionObligacionLayout } from "@/modules/obligaciones/components/GestionObligacionLayout";

const today = () => new Date().toISOString().slice(0, 10);

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function GestionCcssPage() {
  const { data, loading, error, reload, mutate } = useApiQuery("ccss", fetchAportesCcss);
  const rows = data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    periodo: currentMonthInput(),
    tipo: "cuota_obrero_patronal" as TipoAporteCcss,
    numeroPatrono: "",
    fechaPago: today(),
    monto: "",
    concepto: "",
  });

  const year = String(new Date().getFullYear());
  const totalYear = rows
    .filter((r) => r.periodo.startsWith(year))
    .reduce((s, r) => s + r.monto, 0);
  const last = rows[0];
  const prevKey = previousMonthKey();
  const faltaMesAnterior = !rows.some(
    (r) => r.periodo === prevKey && r.tipo === "cuota_obrero_patronal"
  );

  const byPeriodo = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.periodo, (map.get(r.periodo) ?? 0) + r.monto);
    return map;
  }, [rows]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      periodo: currentMonthInput(),
      tipo: "cuota_obrero_patronal",
      numeroPatrono: last?.numeroPatrono ?? "",
      fechaPago: today(),
      monto: "",
      concepto: "",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        periodo: form.periodo,
        tipo: form.tipo,
        numeroPatrono: form.numeroPatrono.trim() || null,
        fechaPago: form.fechaPago,
        monto: Number(form.monto),
        concepto: form.concepto.trim() || null,
      };
      if (editingId) await updateAporteCcssApi(editingId, payload);
      else await createAporteCcssApi(payload);
      invalidateApiCacheMany(["ccss", "costs", "dashboard"]);
      await reload();
      setDialogOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GestionObligacionLayout
      title="Caja Costarricense de Seguro Social"
      description="Cuotas obrero-patronales y aportes CCSS"
      icon={Building2}
      iconClass="text-teal-700"
      error={error}
      onAdd={openAdd}
      addLabel="Nuevo aporte"
      kpis={[
        { label: `Total ${year}`, value: formatCurrency(totalYear) },
        {
          label: "Último período",
          value: last ? formatPeriodoLabel(last.periodo) : "—",
          hint: last ? formatCurrency(byPeriodo.get(last.periodo) ?? last.monto) : undefined,
        },
        { label: "Registros", value: String(rows.length) },
        {
          label: "Mes anterior",
          value: faltaMesAnterior ? "Sin cuota" : "Pagado",
          alert: faltaMesAnterior,
          hint: formatPeriodoLabel(prevKey),
        },
      ]}
    >
      <Card>
        <CardHeader className="pb-2" />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Patrono</TableHead>
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
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No hay aportes CCSS registrados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {formatPeriodoLabel(row.periodo)}
                    </TableCell>
                    <TableCell>{TIPO_APORTE_CCSS_LABEL[row.tipo]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.numeroPatrono ?? "—"}
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
                        <Link href="/gestion/comprobantes" className="p-1.5 inline-flex hover:bg-muted rounded-lg">
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-muted"
                        onClick={() => {
                          setEditingId(row.id);
                          setForm({
                            periodo: `${row.periodo.slice(0, 4)}-${row.periodo.slice(4, 6)}`,
                            tipo: row.tipo,
                            numeroPatrono: row.numeroPatrono ?? "",
                            fechaPago: row.fechaPago,
                            monto: String(row.monto),
                            concepto: row.concepto,
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
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
            <DialogTitle>{editingId ? "Editar aporte" : "Nuevo aporte CCSS"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Período</Label>
              <Input
                type="month"
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAporteCcss })}
              >
                {TIPOS_APORTE_CCSS.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_APORTE_CCSS_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Número de patrono</Label>
              <Input
                value={form.numeroPatrono}
                onChange={(e) => setForm({ ...form, numeroPatrono: e.target.value })}
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
              <Label>Monto (₡)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div>
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
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar aporte</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">También se anula el gasto en Costos.</p>
          <DialogFooter>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setDeleteId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm"
              onClick={async () => {
                if (!deleteId) return;
                await deleteAporteCcssApi(deleteId);
                mutate(rows.filter((r) => r.id !== deleteId));
                invalidateApiCacheMany(["ccss", "costs", "dashboard"]);
                setDeleteId(null);
              }}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GestionObligacionLayout>
  );
}
