"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Module } from "@/lib/types/domain";
import type { Animal } from "@/lib/types/domain";
import { useModules } from "@/lib/hooks/useModules";
import {
  MODULE_TYPE_OPTIONS,
  moduleTypeColor,
  moduleTypeLabel,
} from "@/lib/modulos/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Grid3X3,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  Users,
  Loader2,
  Eye,
} from "lucide-react";

type FormState = {
  name: string;
  type: string;
  capacity: string;
};

const emptyForm: FormState = {
  name: "",
  type: "engorda",
  capacity: "",
};

type Props = {
  variant?: "cards" | "table";
  showBackLink?: boolean;
  title?: string;
  animals?: Animal[];
};

export function ModulosManager({
  variant = "cards",
  showBackLink = false,
  title = "Módulos",
  animals = [],
}: Props) {
  const {
    modules,
    loading,
    error,
    mutating,
    actionError,
    clearActionError,
    addModule,
    updateModule,
    removeModule,
  } = useModules();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewCodigo, setPreviewCodigo] = useState("");

  const totalCapacity = modules.reduce((s, m) => s + m.capacity, 0);
  const totalAnimals = modules.reduce((s, m) => s + m.animalCount, 0);
  const activeCount = animals.filter((a) => a.status === "activo").length;

  const editingMod = editingId
    ? modules.find((m) => m.id === editingId)
    : undefined;

  useEffect(() => {
    if (!dialogOpen) return;

    if (editingMod && editingMod.type === form.type) {
      setPreviewCodigo(editingMod.id);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({ type: form.type });
    if (editingMod?.uuid) params.set("excludeId", editingMod.uuid);

    void (async () => {
      try {
        const res = await fetch(`/api/modules/next-code?${params}`, {
          cache: "no-store",
        });
        const body = (await res.json()) as { code?: string; error?: string };
        if (!cancelled && res.ok && body.code) setPreviewCodigo(body.code);
      } catch {
        if (!cancelled) setPreviewCodigo("…");
      }
    })();

    return () => {
      cancelled = true;
    };
    // editingMod se deriva de editingId + modules; usamos campos estables.
  }, [dialogOpen, form.type, editingId, editingMod?.id, editingMod?.type, editingMod?.uuid]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPreviewCodigo("");
    setFormError(null);
    clearActionError();
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    setEditingId(id);
    setForm({
      name: mod.name,
      type: mod.type,
      capacity: String(mod.capacity),
    });
    setPreviewCodigo(mod.id);
    setFormError(null);
    clearActionError();
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const capacity = Number(form.capacity);
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (!capacity || capacity <= 0) {
      setFormError("La capacidad debe ser mayor a 0.");
      return;
    }

    try {
      if (editingId) {
        await updateModule(editingId, {
          name: form.name.trim(),
          type: form.type,
          capacity,
        });
      } else {
        await addModule({
          name: form.name.trim(),
          type: form.type,
          capacity,
        });
      }
      setDialogOpen(false);
    } catch {
      // actionError en el hook
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await removeModule(deleteId);
      setDeleteId(null);
    } catch {
      // actionError en el hook
    }
  };

  const deleteTarget = deleteId
    ? modules.find((m) => m.id === deleteId)
    : undefined;

  const renderActions = (mod: Module) => (
    <div className="flex items-center gap-1">
      <Link
        href={`/modules/${encodeURIComponent(mod.id)}`}
        className="p-1.5 rounded-lg hover:bg-violet-50 transition-colors text-muted-foreground hover:text-violet-700"
        title="Ver animales y detalles"
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={() => openEdit(mod.id)}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          clearActionError();
          setDeleteId(mod.id);
        }}
        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
        title="Eliminar"
        disabled={mod.animalCount > 0}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBackLink && (
            <Link
              href="/gestion"
              className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-violet-600 shrink-0" />
              <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading
                ? "Cargando…"
                : `${modules.length} módulos · ${variant === "cards" ? activeCount || totalAnimals : totalAnimals} animales en producción`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={mutating}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Nuevo módulo
        </button>
      </div>

      {(error || actionError) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error ?? actionError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-4 bg-violet-50 text-violet-700 border-violet-200">
          <p className="text-2xl font-bold">{loading ? "…" : modules.length}</p>
          <p className="text-sm font-medium mt-0.5">Módulos totales</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 text-emerald-700 border-emerald-200">
          <p className="text-2xl font-bold">{loading ? "…" : totalCapacity}</p>
          <p className="text-sm font-medium mt-0.5">Capacidad total</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200">
          <p className="text-2xl font-bold">{loading ? "…" : totalAnimals}</p>
          <p className="text-sm font-medium mt-0.5">Animales asignados</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-48 bg-muted/30" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No hay módulos registrados.</p>
            <p className="text-sm mt-1">Crea el primer módulo con el botón &quot;Nuevo módulo&quot;.</p>
          </CardContent>
        </Card>
      ) : variant === "table" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-violet-600" />
              Listado de módulos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Animales</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell className="font-mono font-semibold text-xs">
                        <Link
                          href={`/modules/${encodeURIComponent(mod.id)}`}
                          className="hover:text-violet-700 hover:underline"
                        >
                          {mod.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/modules/${encodeURIComponent(mod.id)}`}
                          className="hover:text-violet-700 hover:underline"
                        >
                          {mod.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-lg font-medium ${moduleTypeColor(mod.type)}`}
                        >
                          {moduleTypeLabel(mod.type)}
                        </span>
                      </TableCell>
                      <TableCell>{mod.capacity}</TableCell>
                      <TableCell className="font-medium">{mod.animalCount}</TableCell>
                      <TableCell className="text-right">
                        {renderActions(mod)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const moduleAnimals = animals.filter(
              (a) => a.moduleId === mod.id && a.status === "activo"
            );
            const avgWeight =
              moduleAnimals.length > 0
                ? Math.round(
                    moduleAnimals.reduce((s, a) => s + a.currentWeight, 0) /
                      moduleAnimals.length
                  )
                : 0;

            return (
              <Card key={mod.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/modules/${encodeURIComponent(mod.id)}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 shrink-0 group-hover:bg-emerald-200 transition-colors">
                        <Grid3X3 className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate group-hover:text-violet-700 transition-colors">
                          {mod.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{mod.id}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${moduleTypeColor(mod.type)}`}
                      >
                        {moduleTypeLabel(mod.type)}
                      </span>
                      {renderActions(mod)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{moduleAnimals.length} activos</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Peso prom.: </span>
                      <span className="font-semibold text-emerald-700">
                        {avgWeight > 0 ? `${avgWeight} kg` : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Capacidad: {mod.capacity} · Asignados: {mod.animalCount}
                  </p>
                  {moduleAnimals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                      {moduleAnimals.map((a) => (
                        <span
                          key={a.id}
                          className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-lg"
                        >
                          {a.tagId}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/modules/${encodeURIComponent(mod.id)}`}
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-violet-200 bg-violet-50 text-violet-800 text-sm font-medium py-2 hover:bg-violet-100 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver animales y modificaciones
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-violet-600" />
              {editingId ? "Editar módulo" : "Nuevo módulo"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Actualiza los datos del módulo. Si cambias el tipo, se asignará un código nuevo."
                : "El código se genera automáticamente según el tipo de módulo."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {(formError || actionError) && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {formError ?? actionError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="mod-type">Tipo *</Label>
              <Select
                id="mod-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {MODULE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-code">Código</Label>
              <Input
                id="mod-code"
                value={previewCodigo}
                readOnly
                className="font-mono bg-muted/40"
              />
              <p className="text-xs text-muted-foreground">
                {editingMod && editingMod.type !== form.type
                  ? `Al cambiar el tipo, el código se actualizará a ${previewCodigo}.`
                  : "Se asigna automáticamente según el tipo de módulo."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-name">Nombre *</Label>
              <Input
                id="mod-name"
                placeholder="Corral Engorda 6"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-capacity">Capacidad *</Label>
              <Input
                id="mod-capacity"
                type="number"
                min="1"
                placeholder="20"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                disabled={mutating}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-60"
              >
                {mutating && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Guardar cambios" : "Crear módulo"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer desde esta pantalla.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el módulo{" "}
            <strong>
              {deleteTarget?.name} ({deleteTarget?.id})
            </strong>
            ? Esta acción no se puede deshacer.
          </p>
          {deleteTarget && deleteTarget.animalCount > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Este módulo tiene {deleteTarget.animalCount} animal(es) activo(s). Reasígnalos
              antes de eliminarlo.
            </p>
          )}
          {actionError && deleteId && (
            <p className="text-sm text-red-600">{actionError}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
              disabled={mutating}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={mutating || (deleteTarget?.animalCount ?? 0) > 0}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors inline-flex items-center gap-2 disabled:opacity-60"
            >
              {mutating && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
