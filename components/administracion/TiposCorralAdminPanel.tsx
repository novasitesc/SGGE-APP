"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTipoCorral,
  fetchTiposCorralAdmin,
  updateTipoCorralApi,
  type TipoCorralAdmin,
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
import { Loader2, Pencil, Plus, Warehouse } from "lucide-react";

export function TiposCorralAdminPanel() {
  const [rows, setRows] = useState<TipoCorralAdmin[]>([]);
  const [fromDb, setFromDb] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoCorralAdmin | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTiposCorralAdmin();
      setRows(data.items);
      setFromDb(data.fromDb);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tipos");
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
    setPrefijo("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: TipoCorralAdmin) => {
    setEditing(row);
    setNombre(row.nombre);
    setCodigo(row.codigo);
    setPrefijo(row.prefijo);
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
        await updateTipoCorralApi(editing.id, {
          nombre: n,
          codigo: codigo.trim() || undefined,
          prefijo: prefijo.trim() || undefined,
        });
      } else {
        await createTipoCorral({
          nombre: n,
          codigo: codigo.trim() || undefined,
          prefijo: prefijo.trim() || undefined,
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

  const readOnlyFallback = rows.some((r) => r.id.startsWith("const:"));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo tipo
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="h-4 w-4 text-emerald-600" />
            Tipos de corral
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clasificación operativa de módulos (engorda, cuarentena, etc.) y
            prefijo de código.
          </p>
          {readOnlyFallback && (
            <p className="text-xs text-amber-700 mt-2">
              Mostrando tipos por defecto. Aplique la migración{" "}
              <code className="text-[10px]">20260803120000_tipos_corral.sql</code>{" "}
              para crear y editar en base de datos.
            </p>
          )}
          {!fromDb && !readOnlyFallback && null}
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
              No hay tipos configurados.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead className="w-24">Prefijo</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell className="font-mono text-xs">{r.prefijo}</TableCell>
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
                          disabled={r.id.startsWith("const:")}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            r.id.startsWith("const:")
                              ? "Requiere migración en BD"
                              : "Editar"
                          }
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
              {editing ? "Editar tipo de corral" : "Nuevo tipo de corral"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tc-nombre">Nombre *</Label>
              <Input
                id="tc-nombre"
                placeholder="Engorda"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-codigo">Código (opcional)</Label>
              <Input
                id="tc-codigo"
                placeholder="engorda"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toLowerCase())}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-prefijo">Prefijo de código</Label>
              <Input
                id="tc-prefijo"
                placeholder="M"
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
                maxLength={10}
              />
              <p className="text-[11px] text-muted-foreground">
                Se usa al crear módulos (p. ej. M → M1, M2…).
              </p>
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
