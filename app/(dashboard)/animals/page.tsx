"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useStore } from "@/store/useStore";
import { formatDate } from "@/lib/utils";
import { Plus, Search, Filter, Beef } from "lucide-react";
import { Animal, AnimalStatus } from "@/lib/mockData";

const statusConfig = {
  activo: { label: "Activo", variant: "success" as const },
  vendido: { label: "Vendido", variant: "info" as const },
  muerto: { label: "Muerto", variant: "destructive" as const },
  enfermo: { label: "Enfermo", variant: "warning" as const },
};

const breeds = ["Angus", "Simmental", "Brahman", "Charolais", "Hereford", "Brangus", "Simbrah", "Otra"];
const moduleIds = ["M1", "M2", "M3", "M4", "M5"];

const defaultForm = {
  tagId: "",
  breed: "Angus",
  entryDate: new Date().toISOString().split("T")[0],
  initialWeight: "",
  currentWeight: "",
  moduleId: "M1",
  status: "activo" as AnimalStatus,
  sex: "M" as "M" | "H",
  age: "",
};

export default function AnimalsPage() {
  const { animals, addAnimal } = useStore();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const filtered = animals.filter((a) => {
    const matchSearch =
      a.tagId.toLowerCase().includes(search.toLowerCase()) ||
      a.breed.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAnimal({
      ...form,
      initialWeight: Number(form.initialWeight),
      currentWeight: Number(form.currentWeight),
      age: Number(form.age),
    });
    setForm(defaultForm);
    setOpen(false);
  };

  const countByStatus = (status: AnimalStatus) => animals.filter((a) => a.status === status).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Animales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {animals.length} animales registrados en el sistema
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />
              Agregar Animal
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Beef className="h-5 w-5 text-emerald-600" />
                Registrar Nuevo Animal
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tagId">Número de Arete *</Label>
                  <Input
                    id="tagId"
                    placeholder="BV-021"
                    value={form.tagId}
                    onChange={(e) => setForm({ ...form, tagId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="breed">Raza *</Label>
                  <Select
                    id="breed"
                    value={form.breed}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })}
                  >
                    {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sex">Sexo</Label>
                  <Select
                    id="sex"
                    value={form.sex}
                    onChange={(e) => setForm({ ...form, sex: e.target.value as "M" | "H" })}
                  >
                    <option value="M">Macho</option>
                    <option value="H">Hembra</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="age">Edad (meses)</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="18"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entryDate">Fecha de Entrada *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={form.entryDate}
                  onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="initialWeight">Peso Inicial (kg) *</Label>
                  <Input
                    id="initialWeight"
                    type="number"
                    placeholder="220"
                    value={form.initialWeight}
                    onChange={(e) => setForm({ ...form, initialWeight: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currentWeight">Peso Actual (kg) *</Label>
                  <Input
                    id="currentWeight"
                    type="number"
                    placeholder="220"
                    value={form.currentWeight}
                    onChange={(e) => setForm({ ...form, currentWeight: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="moduleId">Módulo</Label>
                  <Select
                    id="moduleId"
                    value={form.moduleId}
                    onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
                  >
                    {moduleIds.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    id="status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as AnimalStatus })}
                  >
                    <option value="activo">Activo</option>
                    <option value="enfermo">Enfermo</option>
                    <option value="vendido">Vendido</option>
                    <option value="muerto">Muerto</option>
                  </Select>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Registrar Animal
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { status: "activo", label: "Activos", color: "bg-green-50 text-green-700 border-green-200" },
          { status: "enfermo", label: "Enfermos", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { status: "vendido", label: "Vendidos", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { status: "muerto", label: "Muertos", color: "bg-red-50 text-red-700 border-red-200" },
        ].map(({ status, label, color }) => (
          <div key={status} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-2xl font-bold">{countByStatus(status as AnimalStatus)}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por arete o raza..."
                className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none min-w-[160px]"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="enfermo">Enfermo</option>
                <option value="vendido">Vendido</option>
                <option value="muerto">Muerto</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Arete</TableHead>
                <TableHead>Raza</TableHead>
                <TableHead className="hidden md:table-cell">Sexo</TableHead>
                <TableHead className="hidden lg:table-cell">F. Entrada</TableHead>
                <TableHead>Peso Ini.</TableHead>
                <TableHead>Peso Act.</TableHead>
                <TableHead className="hidden sm:table-cell">Ganancia</TableHead>
                <TableHead className="hidden md:table-cell">Módulo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No se encontraron animales con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((animal) => {
                  const gain = animal.currentWeight - animal.initialWeight;
                  const status = statusConfig[animal.status];
                  return (
                    <TableRow key={animal.id}>
                      <TableCell className="font-mono font-semibold text-xs">{animal.tagId}</TableCell>
                      <TableCell className="font-medium">{animal.breed}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {animal.sex === "M" ? "Macho" : "Hembra"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {formatDate(animal.entryDate)}
                      </TableCell>
                      <TableCell>{animal.initialWeight} kg</TableCell>
                      <TableCell className="font-semibold">{animal.currentWeight} kg</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-emerald-600 font-medium text-sm">+{gain} kg</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-lg font-medium">{animal.moduleId}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Mostrando {filtered.length} de {animals.length} animales
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
