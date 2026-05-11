"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { AnimalStatus, AcquisitionType } from "@/lib/mockData";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Beef,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  Search,
  Filter,
  Gavel,
} from "lucide-react";

const statusConfig = {
  activo: { label: "Activo", variant: "success" as const },
  vendido: { label: "Vendido", variant: "info" as const },
  muerto: { label: "Muerto", variant: "destructive" as const },
  enfermo: { label: "Enfermo", variant: "warning" as const },
};

const breeds = ["Angus", "Simmental", "Brahman", "Charolais", "Hereford", "Brangus", "Simbrah", "Otra"];

const emptyForm = {
  tagId: "",
  breed: "Angus",
  entryDate: new Date().toISOString().split("T")[0],
  initialWeight: "",
  currentWeight: "",
  moduleId: "M1",
  status: "activo" as AnimalStatus,
  sex: "M" as "M" | "H",
  age: "",
  acquisitionType: "subasta" as AcquisitionType,
  invoiceFolio: "",
  invoiceOrAuctionDate: "",
  auctionLotNumber: "",
  purchasePricePerKg: "",
};

const acquisitionLabel: Record<AcquisitionType, string> = {
  subasta: "Subasta",
  particular: "Particular",
  otro: "Otro",
};

export default function GestionAnimalesPage() {
  const { animals, modules, addAnimal, updateAnimal, removeAnimal } = useStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const moduleIds = modules.map((m) => m.id);

  const filtered = animals.filter((a) => {
    const matchSearch =
      a.tagId.toLowerCase().includes(search.toLowerCase()) ||
      a.breed.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const countByStatus = (s: AnimalStatus) => animals.filter((a) => a.status === s).length;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const animal = animals.find((a) => a.id === id);
    if (!animal) return;
    setEditingId(id);
    setForm({
      tagId: animal.tagId,
      breed: animal.breed,
      entryDate: animal.entryDate,
      initialWeight: String(animal.initialWeight),
      currentWeight: String(animal.currentWeight),
      moduleId: animal.moduleId,
      status: animal.status,
      sex: animal.sex,
      age: String(animal.age),
      acquisitionType: animal.acquisitionType ?? "subasta",
      invoiceFolio: animal.invoiceFolio ?? "",
      invoiceOrAuctionDate: animal.invoiceOrAuctionDate ?? "",
      auctionLotNumber: animal.auctionLotNumber ?? "",
      purchasePricePerKg: animal.purchasePricePerKg != null ? String(animal.purchasePricePerKg) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ppk = form.purchasePricePerKg.trim();
    const payload = {
      tagId: form.tagId,
      breed: form.breed,
      entryDate: form.entryDate,
      initialWeight: Number(form.initialWeight),
      currentWeight: Number(form.currentWeight),
      moduleId: form.moduleId,
      status: form.status,
      sex: form.sex,
      age: Number(form.age) || 0,
      acquisitionType: form.acquisitionType,
      invoiceFolio: form.invoiceFolio || undefined,
      invoiceOrAuctionDate: form.invoiceOrAuctionDate || undefined,
      auctionLotNumber: form.auctionLotNumber || undefined,
      purchasePricePerKg: ppk ? Number(ppk) : undefined,
    };
    if (editingId) {
      updateAnimal(editingId, payload);
    } else {
      addAnimal(payload);
    }
    setDialogOpen(false);
  };

  const doDelete = () => {
    if (deleteId) removeAnimal(deleteId);
    setDeleteId(null);
  };

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
              <Beef className="h-5 w-5 text-emerald-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Animales</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {animals.length} animales registrados en el sistema
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar Animal
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { status: "activo" as AnimalStatus, label: "Activos", color: "bg-green-50 text-green-700 border-green-200" },
          { status: "enfermo" as AnimalStatus, label: "Enfermos", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { status: "vendido" as AnimalStatus, label: "Vendidos", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { status: "muerto" as AnimalStatus, label: "Muertos", color: "bg-red-50 text-red-700 border-red-200" },
        ].map(({ status, label, color }) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "todos" : status)}
            className={`rounded-xl border p-4 text-left transition-all ${color} ${filterStatus === status ? "ring-2 ring-offset-1 ring-current" : "hover:opacity-80"}`}
          >
            <p className="text-2xl font-bold">{countByStatus(status)}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters + Table */}
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
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No se encontraron animales con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((animal) => {
                  const gain = animal.currentWeight - animal.initialWeight;
                  const sc = statusConfig[animal.status];
                  return (
                    <TableRow key={animal.id}>
                      <TableCell className="font-mono font-semibold text-xs">{animal.tagId}</TableCell>
                      <TableCell>{animal.breed}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
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
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(animal.id)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(animal.id)}
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
          <p className="text-xs text-muted-foreground mt-3">
            Mostrando {filtered.length} de {animals.length} animales
          </p>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beef className="h-5 w-5 text-emerald-600" />
              {editingId ? "Editar Animal" : "Registrar Nuevo Animal"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="an-tag">Número de Arete *</Label>
                <Input id="an-tag" placeholder="BV-021" value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an-breed">Raza *</Label>
                <Select id="an-breed" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })}>
                  {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="an-sex">Sexo</Label>
                <Select id="an-sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as "M" | "H" })}>
                  <option value="M">Macho</option>
                  <option value="H">Hembra</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an-age">Edad (meses)</Label>
                <Input id="an-age" type="number" placeholder="18" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="an-entry">Fecha de Entrada *</Label>
              <Input id="an-entry" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="an-iw">Peso Inicial (kg) *</Label>
                <Input id="an-iw" type="number" placeholder="220" value={form.initialWeight} onChange={(e) => setForm({ ...form, initialWeight: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an-cw">Peso Actual (kg) *</Label>
                <Input id="an-cw" type="number" placeholder="380" value={form.currentWeight} onChange={(e) => setForm({ ...form, currentWeight: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="an-mod">Módulo</Label>
                <Select id="an-mod" value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}>
                  {moduleIds.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an-status">Estado</Label>
                <Select id="an-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AnimalStatus })}>
                  <option value="activo">Activo</option>
                  <option value="enfermo">Enfermo</option>
                  <option value="vendido">Vendido</option>
                  <option value="muerto">Muerto</option>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5" />
                Compra / subasta
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="an-acq">Origen de compra</Label>
                <Select id="an-acq" value={form.acquisitionType} onChange={(e) => setForm({ ...form, acquisitionType: e.target.value as AcquisitionType })}>
                  <option value="subasta">Subasta ganadera</option>
                  <option value="particular">Particular</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="an-folio">Folio de factura</Label>
                  <Input id="an-folio" placeholder="410756" value={form.invoiceFolio} onChange={(e) => setForm({ ...form, invoiceFolio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="an-inv-date">Fecha factura / remate</Label>
                  <Input id="an-inv-date" type="date" value={form.invoiceOrAuctionDate} onChange={(e) => setForm({ ...form, invoiceOrAuctionDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="an-lot">No. de lote</Label>
                  <Input id="an-lot" placeholder="L-12" value={form.auctionLotNumber} onChange={(e) => setForm({ ...form, auctionLotNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="an-ppkg">Precio compra ($/kg)</Label>
                  <Input id="an-ppkg" type="number" step="0.01" min="0" placeholder="52.50" value={form.purchasePricePerKg} onChange={(e) => setForm({ ...form, purchasePricePerKg: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                {editingId ? "Guardar cambios" : "Registrar Animal"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas eliminar el animal{" "}
            <strong>{animals.find((a) => a.id === deleteId)?.tagId}</strong>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={doDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
