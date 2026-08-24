"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Trash2, Users, Wallet } from "lucide-react";
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
  createSalarioApi,
  deleteSalarioApi,
  fetchEmpleados,
  fetchSalarios,
  updateSalarioApi,
} from "@/lib/api/obligaciones-client";
import {
  TIPO_SALARIO_LABEL,
  TIPOS_SALARIO,
  type TipoSalario,
} from "@/modules/obligaciones";
import { GestionObligacionLayout } from "@/modules/obligaciones/components/GestionObligacionLayout";
import { EmpleadosDialog } from "@/modules/obligaciones/components/EmpleadosDialog";

const today = () => new Date().toISOString().slice(0, 10);

export default function GestionSalariosPage() {
  const { data, loading, error, reload, mutate } = useApiQuery("salarios", fetchSalarios);
  const empQ = useApiQuery("empleados", () => fetchEmpleados(true));
  const rows = data ?? [];
  const empleados = empQ.data ?? [];
  const [staffOpen, setStaffOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    empleadoId: "",
    empleadoNombre: "",
    periodoInicio: "",
    periodoFin: "",
    tipo: "ordinario" as TipoSalario,
    monto: "",
    fechaPago: today(),
    concepto: "",
  });

  const total = rows.reduce((s, r) => s + r.monto, 0);
  const byTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.tipo, (m.get(r.tipo) ?? 0) + r.monto);
    return m;
  }, [rows]);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        empleadoId: form.empleadoId || null,
        empleadoNombre: form.empleadoNombre.trim() || null,
        periodoInicio: form.periodoInicio || null,
        periodoFin: form.periodoFin || null,
        tipo: form.tipo,
        monto: Number(form.monto),
        fechaPago: form.fechaPago,
        concepto: form.concepto.trim() || null,
      };
      if (editingId) await updateSalarioApi(editingId, payload);
      else await createSalarioApi(payload);
      invalidateApiCacheMany(["salarios", "costs", "dashboard"]);
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
      title="Salarios"
      description="Planilla y pagos de personal · los jornales sueltos siguen en Mano de obra"
      icon={Wallet}
      iconClass="text-blue-700"
      error={error ?? empQ.error}
      onAdd={() => {
        setEditingId(null);
        setForm({
          empleadoId: "",
          empleadoNombre: "",
          periodoInicio: "",
          periodoFin: "",
          tipo: "ordinario",
          monto: "",
          fechaPago: today(),
          concepto: "",
        });
        setFormError(null);
        setDialogOpen(true);
      }}
      addLabel="Nuevo pago"
      extraActions={
        <button
          type="button"
          onClick={() => setStaffOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Users className="h-4 w-4" />
          Personal
        </button>
      }
      kpis={[
        { label: "Total planilla", value: formatCurrency(total) },
        { label: "Pagos", value: String(rows.length) },
        {
          label: "Ordinario",
          value: formatCurrency(byTipo.get("ordinario") ?? 0),
        },
        { label: "Empleados", value: String(empleados.filter((e) => e.activo).length) },
      ]}
    >
      <Card>
        <CardHeader className="pb-2" />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
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
                    No hay salarios registrados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.empleadoNombre}</TableCell>
                    <TableCell>{TIPO_SALARIO_LABEL[row.tipo]}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.periodoInicio && row.periodoFin
                        ? `${formatDate(row.periodoInicio)} – ${formatDate(row.periodoFin)}`
                        : "—"}
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
                            empleadoId: row.empleadoId ?? "",
                            empleadoNombre: row.empleadoNombre,
                            periodoInicio: row.periodoInicio ?? "",
                            periodoFin: row.periodoFin ?? "",
                            tipo: row.tipo,
                            monto: String(row.monto),
                            fechaPago: row.fechaPago,
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
            <DialogTitle>{editingId ? "Editar salario" : "Nuevo pago de salario"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Empleado</Label>
              <Select
                value={form.empleadoId}
                onChange={(e) => {
                  const id = e.target.value;
                  const emp = empleados.find((x) => x.id === id);
                  setForm({
                    ...form,
                    empleadoId: id,
                    empleadoNombre: emp
                      ? [emp.nombre, emp.apellido].filter(Boolean).join(" ")
                      : form.empleadoNombre,
                  });
                }}
              >
                <option value="">Nombre libre…</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.nombre, e.apellido].filter(Boolean).join(" ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Nombre (si no está en catálogo)</Label>
              <Input
                value={form.empleadoNombre}
                onChange={(e) => setForm({ ...form, empleadoNombre: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoSalario })}
              >
                {TIPOS_SALARIO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_SALARIO_LABEL[t]}
                  </option>
                ))}
              </Select>
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
            <DialogTitle>Eliminar salario</DialogTitle>
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
                await deleteSalarioApi(deleteId);
                mutate(rows.filter((r) => r.id !== deleteId));
                invalidateApiCacheMany(["salarios", "costs", "dashboard"]);
                setDeleteId(null);
              }}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmpleadosDialog
        open={staffOpen}
        onOpenChange={setStaffOpen}
        empleados={empleados}
        onChanged={async () => {
          invalidateApiCacheMany(["empleados"]);
          await empQ.reload();
        }}
      />
    </GestionObligacionLayout>
  );
}
