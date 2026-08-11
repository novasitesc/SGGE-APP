"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createLote,
  fetchLotesAdmin,
  updateLoteApi,
  type LoteAdmin,
} from "@/lib/api/data-client";
import { useActiveLote } from "@/components/lotes/LoteProvider";
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
import { Grid3X3, Loader2, Pencil, Plus } from "lucide-react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function LotesAdminPanel() {
  const { reloadLotes } = useActiveLote();
  const [rows, setRows] = useState<LoteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LoteAdmin | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<"abierto" | "cerrado">("abierto");
  const [fechaApertura, setFechaApertura] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchLotesAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar lotes");
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
    setEstado("abierto");
    setFechaApertura(todayIso());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: LoteAdmin) => {
    setEditing(row);
    setNombre(row.nombre);
    setCodigo(row.codigo);
    setEstado(row.estado === "cerrado" ? "cerrado" : "abierto");
    setFechaApertura(row.fecha_apertura ?? todayIso());
    setFormError(null);
    setDialogOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nombre.trim() || codigo.trim();
    if (!n) {
      setFormError("El nombre o código es obligatorio.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await updateLoteApi(editing.id, {
          nombre: n,
          codigo: codigo.trim() || undefined,
          estado,
          fecha_apertura: fechaApertura,
        });
      } else {
        await createLote({
          nombre: n,
          codigo: codigo.trim() || undefined,
          estado,
          fecha_apertura: fechaApertura,
        });
      }
      setDialogOpen(false);
      await reload();
      await reloadLotes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo lote
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3X3 className="h-4 w-4 text-emerald-600" />
            Lotes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada lote es un ciclo de engorda: las estadísticas de animales
            (inventario, pesos, ganancias, ventas del hato) se segmentan por
            lote. Un lote nuevo arranca en cero. Gastos, catálogos y módulos se
            comparten a nivel granja.
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
              No hay lotes. Crea uno abierto antes de registrar alimentación.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead className="w-32">Apertura</TableHead>
                    <TableHead className="w-32">Cierre</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell>
                        <span
                          className={
                            r.estado === "abierto"
                              ? "text-xs text-emerald-700"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {r.estado === "abierto" ? "Abierto" : "Cerrado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(r.fecha_apertura)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(r.fecha_cierre)}
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
            <DialogTitle>{editing ? "Editar lote" : "Nuevo lote"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="lote-nombre">Nombre *</Label>
              <Input
                id="lote-nombre"
                placeholder="Lote julio 2026"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lote-codigo">Código (opcional)</Label>
              <Input
                id="lote-codigo"
                placeholder="Se genera automáticamente"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={30}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lote-fecha">Fecha apertura</Label>
                <Input
                  id="lote-fecha"
                  type="date"
                  value={fechaApertura}
                  onChange={(e) => setFechaApertura(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lote-estado">Estado</Label>
                <select
                  id="lote-estado"
                  value={estado}
                  onChange={(e) =>
                    setEstado(e.target.value === "cerrado" ? "cerrado" : "abierto")
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
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
