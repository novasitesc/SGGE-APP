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
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Filter, Beef, Gavel } from "lucide-react";
import { AnimalStatus, AcquisitionType } from "@/lib/mockData";

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
    const purchasePk = form.purchasePricePerKg.trim();
    addAnimal({
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
      invoiceFolio: form.invoiceFolio.trim() || undefined,
      invoiceOrAuctionDate: form.invoiceOrAuctionDate.trim() || undefined,
      auctionLotNumber: form.auctionLotNumber.trim() || undefined,
      purchasePricePerKg: purchasePk ? Number(purchasePk) : undefined,
    });
    setForm(defaultForm);
    setOpen(false);
  };

  const countByStatus = (status: AnimalStatus) => animals.filter((a) => a.status === status).length;

  const countSubasta = animals.filter((a) => a.acquisitionType === "subasta").length;
  const countWithInvoiceFolio = animals.filter((a) => (a.invoiceFolio ?? "").trim().length > 0).length;
  const countWithLot = animals.filter((a) => (a.auctionLotNumber ?? "").trim().length > 0).length;
  const purchaseInventoryValue = animals.reduce((sum, a) => {
    const p = a.purchasePricePerKg;
    if (p == null || Number.isNaN(p)) return sum;
    return sum + p * a.initialWeight;
  }, 0);
  const avgPurchasePricePerKg = (() => {
    const priced = animals.filter((a) => a.purchasePricePerKg != null && !Number.isNaN(a.purchasePricePerKg!));
    if (priced.length === 0) return 0;
    return priced.reduce((s, a) => s + (a.purchasePricePerKg as number), 0) / priced.length;
  })();

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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

              <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5" />
                  Compra / subasta (como en factura o boleto de remate)
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="acquisitionType">Origen de compra</Label>
                  <Select
                    id="acquisitionType"
                    value={form.acquisitionType}
                    onChange={(e) =>
                      setForm({ ...form, acquisitionType: e.target.value as AcquisitionType })
                    }
                  >
                    <option value="subasta">Subasta ganadera</option>
                    <option value="particular">Particular</option>
                    <option value="otro">Otro</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceFolio">Folio de factura</Label>
                    <Input
                      id="invoiceFolio"
                      placeholder="p. ej. 410756"
                      value={form.invoiceFolio}
                      onChange={(e) => setForm({ ...form, invoiceFolio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceOrAuctionDate">Fecha factura / remate</Label>
                    <Input
                      id="invoiceOrAuctionDate"
                      type="date"
                      value={form.invoiceOrAuctionDate}
                      onChange={(e) => setForm({ ...form, invoiceOrAuctionDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="auctionLotNumber">No. de lote (subasta)</Label>
                    <Input
                      id="auctionLotNumber"
                      placeholder="L-12"
                      value={form.auctionLotNumber}
                      onChange={(e) => setForm({ ...form, auctionLotNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchasePricePerKg">Precio compra ($/kg)</Label>
                    <Input
                      id="purchasePricePerKg"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="52.50"
                      value={form.purchasePricePerKg}
                      onChange={(e) => setForm({ ...form, purchasePricePerKg: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  En subasta suelen registrarse lote, folio de factura, fecha del remate y precio por kg
                  (báscula). Sirve para trazabilidad y valor de inventario al ingreso.
                </p>
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

      {/* Compra / subasta — estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4 bg-slate-50 text-slate-800 border-slate-200">
          <p className="text-2xl font-bold">{countSubasta}</p>
          <p className="text-sm font-medium mt-0.5">Ingreso vía subasta</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-50 text-slate-800 border-slate-200">
          <p className="text-2xl font-bold">{countWithLot}</p>
          <p className="text-sm font-medium mt-0.5">Con no. de lote</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-50 text-slate-800 border-slate-200">
          <p className="text-2xl font-bold">{countWithInvoiceFolio}</p>
          <p className="text-sm font-medium mt-0.5">Con folio factura</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-50 text-slate-800 border-slate-200 lg:col-span-1">
          <p className="text-lg font-bold tabular-nums">{formatCurrency(purchaseInventoryValue)}</p>
          <p className="text-sm font-medium mt-0.5">Valor compra (peso inicial × $/kg)</p>
        </div>
        <div className="rounded-xl border p-4 bg-slate-50 text-slate-800 border-slate-200 col-span-2 lg:col-span-1">
          <p className="text-lg font-bold tabular-nums">
            {avgPurchasePricePerKg > 0 ? formatCurrency(avgPurchasePricePerKg) + "/kg" : "—"}
          </p>
          <p className="text-sm font-medium mt-0.5">Precio compra prom. ($/kg)</p>
        </div>
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
                <TableHead className="hidden xl:table-cell">Origen</TableHead>
                <TableHead className="hidden xl:table-cell">Lote</TableHead>
                <TableHead className="hidden xl:table-cell">Factura</TableHead>
                <TableHead className="hidden 2xl:table-cell text-right">$/kg compra</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {animal.acquisitionType
                          ? acquisitionLabel[animal.acquisitionType]
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell font-mono text-xs">
                        {animal.auctionLotNumber ?? "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell font-mono text-xs">
                        {animal.invoiceFolio ?? "—"}
                      </TableCell>
                      <TableCell className="hidden 2xl:table-cell text-right text-xs tabular-nums">
                        {animal.purchasePricePerKg != null
                          ? formatCurrency(animal.purchasePricePerKg)
                          : "—"}
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
