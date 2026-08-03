"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEstadoAnimal,
  fetchEstadosAnimalesAdmin,
  updateEstadoAnimalApi,
  type EstadoAnimalAdmin,
} from "@/lib/api/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Tag } from "lucide-react";

const SISTEMA = new Set(["activo", "vendido", "muerto", "enfermo"]);

export function EstadosAdminPanel() {
  const [rows, setRows] = useState<EstadoAnimalAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EstadoAnimalAdmin | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchEstadosAnimalesAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar estados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setNombre("");
    setCodigo("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: EstadoAnimalAdmin) => {
    setEditing(row);
    setNombre(row.nombre);
    setCodigo(row.codigo);
    setFormError(null);
    setDialogOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        const payload: { nombre: string; codigo?: string } = { nombre: n };
        if (!SISTEMA.has(editing.codigo.toLowerCase())) {
          payload.codigo = codigo.trim() || undefined;
        }
        await updateEstadoAnimalApi(editing.id, payload);
      } else {
        await createEstadoAnimal({
          nombre: n,
          codigo: codigo.trim() || undefined,
        });
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const codigoLocked =
    editing != null && SISTEMA.has(editing.codigo.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo estado
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-emerald-600" />
            Estados de animal
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Activo, enfermo, vendido y bajas. Los códigos del sistema no se pueden
            renombrar.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 py-6 text-center">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay estados configurados.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.codigo}
                        {SISTEMA.has(r.codigo.toLowerCase()) && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            sistema
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.activo
                              ? "text-xs text-emerald-700"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {r.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar estado" : "Nuevo estado"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="est-nombre">Nombre *</Label>
              <Input
                id="est-nombre"
                placeholder="En observación"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-codigo">Código</Label>
              <Input
                id="est-codigo"
                placeholder="Se genera automáticamente"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toLowerCase())}
                maxLength={30}
                disabled={codigoLocked}
              />
              {codigoLocked && (
                <p className="text-[11px] text-muted-foreground">
                  Este código lo usa la lógica del sistema y no se puede cambiar.
                </p>
              )}
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
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Guardar" : "Crear"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
