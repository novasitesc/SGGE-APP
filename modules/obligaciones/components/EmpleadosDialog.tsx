"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createEmpleadoApi,
  deleteEmpleadoApi,
  updateEmpleadoApi,
} from "@/lib/api/obligaciones-client";
import type { Empleado } from "@/modules/obligaciones";

const empty = {
  nombre: "",
  apellido: "",
  cedula: "",
  puesto: "",
  fechaIngreso: "",
};

export function EmpleadosDialog({
  open,
  onOpenChange,
  empleados,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleados: Empleado[];
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm(empty);
    setEditingId(null);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || null,
        cedula: form.cedula.trim() || null,
        puesto: form.puesto.trim() || null,
        fechaIngreso: form.fechaIngreso || null,
        activo: true,
      };
      if (editingId) await updateEmpleadoApi(editingId, payload);
      else await createEmpleadoApi(payload);
      reset();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Personal de la granja
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <Label>Apellido</Label>
            <Input
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            />
          </div>
          <div>
            <Label>Cédula</Label>
            <Input
              value={form.cedula}
              onChange={(e) => setForm({ ...form, cedula: e.target.value })}
            />
          </div>
          <div>
            <Label>Puesto</Label>
            <Input
              value={form.puesto}
              onChange={(e) => setForm({ ...form, puesto: e.target.value })}
            />
          </div>
          <div>
            <Label>Ingreso</Label>
            <Input
              type="date"
              value={form.fechaIngreso}
              onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          {editingId && (
            <button
              type="button"
              className="text-sm text-muted-foreground"
              onClick={reset}
            >
              Cancelar edición
            </button>
          )}
          <button
            type="button"
            disabled={saving || !form.nombre.trim()}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {editingId ? "Guardar" : "Agregar"}
          </button>
        </DialogFooter>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {empleados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">
                  Sin personal registrado.
                </TableCell>
              </TableRow>
            ) : (
              empleados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {[e.nombre, e.apellido].filter(Boolean).join(" ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.cedula ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.puesto ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-muted"
                      onClick={() => {
                        setEditingId(e.id);
                        setForm({
                          nombre: e.nombre,
                          apellido: e.apellido ?? "",
                          cedula: e.cedula ?? "",
                          puesto: e.puesto ?? "",
                          fechaIngreso: e.fechaIngreso ?? "",
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                      onClick={async () => {
                        await deleteEmpleadoApi(e.id);
                        await onChanged();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
