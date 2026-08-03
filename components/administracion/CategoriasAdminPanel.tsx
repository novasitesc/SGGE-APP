"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createCategoriaAnimal,
  fetchCategoriasAnimalesAdmin,
  updateCategoriaAnimalApi,
  type CategoriaAnimalAdmin,
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
import { Layers, Loader2, Pencil, Plus } from "lucide-react";

function parseOptionalKg(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function CategoriasAdminPanel() {
  const [rows, setRows] = useState<CategoriaAnimalAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaAnimalAdmin | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pesoMin, setPesoMin] = useState("");
  const [pesoMax, setPesoMax] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCategoriasAnimalesAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar categorías");
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
    setPesoMin("");
    setPesoMax("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: CategoriaAnimalAdmin) => {
    setEditing(row);
    setNombre(row.nombre);
    setCodigo(row.codigo);
    setPesoMin(row.peso_min_kg == null ? "" : String(row.peso_min_kg));
    setPesoMax(row.peso_max_kg == null ? "" : String(row.peso_max_kg));
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
    const min = parseOptionalKg(pesoMin);
    const max = parseOptionalKg(pesoMax);
    if (pesoMin.trim() && min == null) {
      setFormError("Peso mínimo inválido.");
      return;
    }
    if (pesoMax.trim() && max == null) {
      setFormError("Peso máximo inválido.");
      return;
    }
    if (min != null && max != null && min > max) {
      setFormError("El peso mínimo no puede ser mayor que el máximo.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await updateCategoriaAnimalApi(editing.id, {
          nombre: n,
          codigo: codigo.trim() || undefined,
          peso_min_kg: min,
          peso_max_kg: max,
        });
      } else {
        await createCategoriaAnimal({
          nombre: n,
          codigo: codigo.trim() || undefined,
          peso_min_kg: min,
          peso_max_kg: max,
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

  const formatRango = (row: CategoriaAnimalAdmin) => {
    if (row.peso_min_kg == null && row.peso_max_kg == null) return "—";
    const a = row.peso_min_kg == null ? "…" : `${row.peso_min_kg}`;
    const b = row.peso_max_kg == null ? "…" : `${row.peso_max_kg}`;
    return `${a} – ${b} kg`;
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
          Nueva categoría
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-emerald-600" />
            Categorías de animal
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ternero, novillo, toro y rangos de peso usados al clasificar animales.
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
              No hay categorías. Agrega la primera para usarla en animales.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead>Rango de peso</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                      <TableCell className="text-sm">{formatRango(r)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            r.activa
                              ? "text-xs text-emerald-700"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {r.activa ? "Activa" : "Inactiva"}
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
              {editing ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-nombre">Nombre *</Label>
              <Input
                id="cat-nombre"
                placeholder="Novillo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-codigo">Código (opcional)</Label>
              <Input
                id="cat-codigo"
                placeholder="Se genera automáticamente"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-min">Peso mín. (kg)</Label>
                <Input
                  id="cat-min"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Sin mínimo"
                  value={pesoMin}
                  onChange={(e) => setPesoMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-max">Peso máx. (kg)</Label>
                <Input
                  id="cat-max"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Sin máximo"
                  value={pesoMax}
                  onChange={(e) => setPesoMax(e.target.value)}
                />
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
