"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { ModuleType } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Grid3X3, Plus, Pencil, Trash2, ChevronLeft, AlertTriangle } from "lucide-react";

const moduleTypeLabel: Record<ModuleType, string> = {
  engorda: "Engorda",
  leche: "Leche",
  cría: "Cría",
  recría: "Recría",
};

const moduleTypeColor: Record<ModuleType, string> = {
  engorda: "bg-emerald-100 text-emerald-700",
  leche: "bg-blue-100 text-blue-700",
  cría: "bg-pink-100 text-pink-700",
  recría: "bg-amber-100 text-amber-700",
};

const emptyForm = {
  name: "",
  type: "engorda" as ModuleType,
  capacity: "",
  animalCount: "",
  location: "",
  supervisor: "",
};

export default function GestionModulosPage() {
  const { modules, addModule, updateModule, removeModule } = useStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
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
      animalCount: String(mod.animalCount),
      location: mod.location,
      supervisor: mod.supervisor,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      capacity: Number(form.capacity),
      animalCount: Number(form.animalCount),
      location: form.location,
      supervisor: form.supervisor,
    };
    if (editingId) {
      updateModule(editingId, payload);
    } else {
      addModule(payload);
    }
    setDialogOpen(false);
  };

  const confirmDelete = (id: string) => setDeleteId(id);
  const doDelete = () => {
    if (deleteId) removeModule(deleteId);
    setDeleteId(null);
  };

  const totalCapacity = modules.reduce((s, m) => s + m.capacity, 0);
  const totalAnimals = modules.reduce((s, m) => s + m.animalCount, 0);
  const occupancy = totalCapacity > 0 ? Math.round((totalAnimals / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/gestion"
            className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-violet-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Módulos</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {modules.length} módulos registrados
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Módulo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 bg-violet-50 text-violet-700 border-violet-200">
          <p className="text-2xl font-bold">{modules.length}</p>
          <p className="text-sm font-medium mt-0.5">Módulos totales</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 text-emerald-700 border-emerald-200">
          <p className="text-2xl font-bold">{totalCapacity}</p>
          <p className="text-sm font-medium mt-0.5">Capacidad total</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200">
          <p className="text-2xl font-bold">{totalAnimals}</p>
          <p className="text-sm font-medium mt-0.5">Animales asignados</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 text-amber-700 border-amber-200">
          <p className="text-2xl font-bold">{occupancy}%</p>
          <p className="text-sm font-medium mt-0.5">Ocupación</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-violet-600" />
            Listado de Módulos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Capacidad</TableHead>
                <TableHead>Animales</TableHead>
                <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                <TableHead className="hidden lg:table-cell">Supervisor</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay módulos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((mod) => {
                  const pct = mod.capacity > 0 ? Math.round((mod.animalCount / mod.capacity) * 100) : 0;
                  return (
                    <TableRow key={mod.id}>
                      <TableCell className="font-mono font-semibold text-xs text-muted-foreground">{mod.id}</TableCell>
                      <TableCell className="font-medium">{mod.name}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${moduleTypeColor[mod.type]}`}>
                          {moduleTypeLabel[mod.type]}
                        </span>
                      </TableCell>
                      <TableCell>{mod.capacity}</TableCell>
                      <TableCell>
                        <span className={mod.animalCount >= mod.capacity ? "text-red-600 font-semibold" : "font-medium"}>
                          {mod.animalCount}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">({pct}%)</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{mod.location}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{mod.supervisor}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(mod.id)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(mod.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-violet-600" />
              {editingId ? "Editar Módulo" : "Nuevo Módulo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="mod-name">Nombre del módulo *</Label>
              <Input
                id="mod-name"
                placeholder="Módulo 6"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mod-type">Tipo</Label>
                <Select
                  id="mod-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ModuleType })}
                >
                  <option value="engorda">Engorda</option>
                  <option value="leche">Leche</option>
                  <option value="cría">Cría</option>
                  <option value="recría">Recría</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mod-capacity">Capacidad</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-count">Animales actuales</Label>
              <Input
                id="mod-count"
                type="number"
                min="0"
                placeholder="0"
                value={form.animalCount}
                onChange={(e) => setForm({ ...form, animalCount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-location">Ubicación</Label>
              <Input
                id="mod-location"
                placeholder="Norte A"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-supervisor">Supervisor</Label>
              <Input
                id="mod-supervisor"
                placeholder="Nombre del supervisor"
                value={form.supervisor}
                onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {editingId ? "Guardar cambios" : "Crear módulo"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este módulo? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={doDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
