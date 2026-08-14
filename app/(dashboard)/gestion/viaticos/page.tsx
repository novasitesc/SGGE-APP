"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, MapPin, Pencil, Trash2, Users } from "lucide-react";
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
  createViaticoApi,
  deleteViaticoApi,
  fetchEmpleados,
  fetchViaticos,
  updateViaticoApi,
} from "@/lib/api/obligaciones-client";
import { GestionObligacionLayout } from "@/modules/obligaciones/components/GestionObligacionLayout";
import { EmpleadosDialog } from "@/modules/obligaciones/components/EmpleadosDialog";

const today = () => new Date().toISOString().slice(0, 10);

export default function GestionViaticosPage() {
  const { data, loading, error, reload, mutate } = useApiQuery("viaticos", fetchViaticos);
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
    fecha: today(),
    destino: "",
    motivo: "",
    monto: "",
  });

  const total = rows.reduce((s, r) => s + r.monto, 0);
  const destinos = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.destino, (m.get(r.destino) ?? 0) + r.monto);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [rows]);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        empleadoId: form.empleadoId || null,
        empleadoNombre: form.empleadoNombre.trim() || null,
        fecha: form.fecha,
        destino: form.destino.trim(),
        motivo: form.motivo.trim() || null,
        monto: Number(form.monto),
      };
      if (editingId) await updateViaticoApi(editingId, payload);
      else await createViaticoApi(payload);
      invalidateApiCacheMany(["viaticos", "costs", "dashboard"]);
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
      title="Viáticos"
      description="Gastos de desplazamiento del personal"
      icon={MapPin}
      iconClass="text-fuchsia-700"
      error={error ?? empQ.error}
      onAdd={() => {
        setEditingId(null);
        setForm({
          empleadoId: "",
          empleadoNombre: "",
          fecha: today(),
          destino: "",
          motivo: "",
          monto: "",
        });
        setFormError(null);
        setDialogOpen(true);
      }}
      addLabel="Nuevo viático"
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
        { label: "Total viáticos", value: formatCurrency(total) },
        { label: "Registros", value: String(rows.length) },
        {
          label: "Destino principal",
          value: destinos[0]?.[0] ?? "—",
          hint: destinos[0] ? formatCurrency(destinos[0][1]) : undefined,
        },
        {
          label: "Otros destinos",
          value: destinos.slice(1).map((d) => d[0]).join(", ") || "—",
        },
      ]}
    >
      <Card>
        <CardHeader className="pb-2" />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Motivo</TableHead>
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
                    No hay viáticos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.empleadoNombre}</TableCell>
                    <TableCell>{row.destino}</TableCell>
                    <TableCell className="text-muted-foreground">{row.motivo ?? "—"}</TableCell>
                    <TableCell>{formatDate(row.fecha)}</TableCell>
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
                            fecha: row.fecha,
                            destino: row.destino,
                            motivo: row.motivo ?? "",
                            monto: String(row.monto),
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
            <DialogTitle>{editingId ? "Editar viático" : "Nuevo viático"}</DialogTitle>
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
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
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
              <Label>Destino</Label>
              <Input
                value={form.destino}
                onChange={(e) => setForm({ ...form, destino: e.target.value })}
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
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
            <DialogTitle>Eliminar viático</DialogTitle>
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
                await deleteViaticoApi(deleteId);
                mutate(rows.filter((r) => r.id !== deleteId));
                invalidateApiCacheMany(["viaticos", "costs", "dashboard"]);
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
