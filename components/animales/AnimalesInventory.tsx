"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnimals } from "@/lib/hooks/useAnimals";
import { fetchCorrales } from "@/lib/api/animals-client";
import { formatDate, formatCurrency } from "@/lib/utils";
import { formatModuleLabel } from "@/lib/modulos/constants";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  ScrollText,
} from "lucide-react";
import type { Animal } from "@/lib/types/domain";
import type { AnimalDetail, AnimalFormValues } from "@/components/animales/types";
import {
  EMPTY_ANIMAL_FORM,
  STATUS_CONFIG,
  animalToForm,
  formToPayload,
  isFinalStatus,
  validateAnimalForm,
} from "@/components/animales/types";
import { AnimalFormDialog } from "@/components/animales/AnimalFormDialog";
import {
  AnimalDeleteDialog,
  type AnimalDeletePayload,
} from "@/components/animales/AnimalDeleteDialog";
import { fetchSolicitudes } from "@/lib/api/solicitudes-client";
import type { AnimalStatus } from "@/lib/types/domain";

type Props = {
  title?: string;
  subtitle?: string;
  showBackLink?: React.ReactNode;
  historialHref?: string;
  fichaHref?: (animalId: string) => string;
};

export function AnimalesInventory({
  title = "Inventario de animales",
  subtitle,
  showBackLink,
  historialHref = "/gestion/historial",
  fichaHref = (id) => `/gestion/animales/${id}`,
}: Props) {
  const {
    animals,
    loading,
    error,
    reload,
    addAnimal,
    updateAnimal,
    requestAnimalDeletion,
    getAnimalDetail,
  } = useAnimals();

  const [corrales, setCorrales] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnimalFormValues>(EMPTY_ANIMAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Animal | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [lockArete, setLockArete] = useState(false);

  const loadPendingDeletes = () => {
    fetchSolicitudes({ estado: "pendiente" })
      .then((data) => {
        const ids = new Set(
          data.items.filter((s) => s.type === "eliminar_animal").map((s) => s.recordId)
        );
        setPendingDeleteIds(ids);
      })
      .catch(() => setPendingDeleteIds(new Set()));
  };

  useEffect(() => {
    fetchCorrales()
      .then((list) => setCorrales(list))
      .catch(() => {});
    loadPendingDeletes();

    const onFocus = () => {
      loadPendingDeletes();
      void reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const filtered = animals.filter((a) => {
    const q = search.toLowerCase();
    const moduleLabel = formatModuleLabel(a.moduleId, a.moduleName).toLowerCase();
    const matchSearch =
      a.tagId.toLowerCase().includes(q) ||
      a.breed.toLowerCase().includes(q) ||
      a.moduleId.toLowerCase().includes(q) ||
      (a.moduleName?.toLowerCase().includes(q) ?? false) ||
      moduleLabel.includes(q);
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const countByStatus = (s: AnimalStatus) =>
    animals.filter((a) => a.status === s).length;

  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setForm({ ...EMPTY_ANIMAL_FORM, moduleId: corrales[0]?.id ?? "M1" });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = async (animal: Animal) => {
    if (isFinalStatus(animal.status)) return;
    setFormMode("edit");
    setEditingId(animal.id);
    setFormError(null);
    try {
      const d = await getAnimalDetail(animal.id);
      setForm(animalToForm(d, d.sale, d.purchase));
      setLockArete(!d.permissions.canChangeArete);
      setFormOpen(true);
    } catch {
      setForm(animalToForm(animal));
      setLockArete(false);
      setFormOpen(true);
    }
  };

  const openDelete = (animal: Animal) => {
    if (isFinalStatus(animal.status)) return;
    if (pendingDeleteIds.has(animal.id)) return;
    setDeleteTarget(animal);
    setDeleteError(null);
    setDeleteSuccess(false);
    setDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateAnimalForm(form, formMode);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const payload = formToPayload(form);
    try {
      if (formMode === "create") {
        await addAnimal(payload);
      } else if (editingId) {
        await updateAnimal(editingId, payload);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (payload: AnimalDeletePayload) => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      await requestAnimalDeletion(deleteTarget.id, payload);
      setDeleteSuccess(true);
      setPendingDeleteIds((prev) => new Set(prev).add(deleteTarget.id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al enviar solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => void reload()} className="ml-auto underline text-xs">
            Reintentar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackLink}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle ?? `${animals.length} animales en inventario · CRUD completo`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={historialHref}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ScrollText className="h-4 w-4" />
            Historial
          </Link>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo animal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            ["activo", "Activos", "bg-green-50 text-green-700 border-green-200"],
            ["enfermo", "Enfermos", "bg-yellow-50 text-yellow-700 border-yellow-200"],
            ["vendido", "Vendidos", "bg-blue-50 text-blue-700 border-blue-200"],
            ["muerto", "Bajas", "bg-red-50 text-red-700 border-red-200"],
          ] as const
        ).map(([status, label, color]) => (
          <button
            key={status}
            type="button"
            onClick={() =>
              setFilterStatus(filterStatus === status ? "todos" : status)
            }
            className={`rounded-xl border p-4 text-left transition-all ${color} ${
              filterStatus === status ? "ring-2 ring-offset-1 ring-current" : ""
            }`}
          >
            <p className="text-2xl font-bold">{countByStatus(status)}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </button>
        ))}
      </div>

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
                <option value="todos">Todos</option>
                <option value="activo">Activo</option>
                <option value="enfermo">Enfermo</option>
                <option value="vendido">Vendido</option>
                <option value="muerto">Muerto</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando inventario...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Arete</TableHead>
                  <TableHead>Raza</TableHead>
                  <TableHead className="hidden md:table-cell">Sexo</TableHead>
                  <TableHead className="hidden lg:table-cell">Ingreso</TableHead>
                  <TableHead>P. ini.</TableHead>
                  <TableHead>P. act.</TableHead>
                  <TableHead className="hidden sm:table-cell">Ganancia</TableHead>
                  <TableHead className="hidden lg:table-cell">Compra ₡/kg</TableHead>
                  <TableHead className="hidden md:table-cell">Corral</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      {animals.length === 0
                        ? "Inventario vacío. Registra el primer animal."
                        : "Sin resultados para los filtros aplicados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((animal) => {
                    const gain = animal.currentWeight - animal.initialWeight;
                    const sc = STATUS_CONFIG[animal.status];
                    const canModify = !isFinalStatus(animal.status);
                    const bajaPendiente = pendingDeleteIds.has(animal.id);
                    return (
                      <TableRow key={animal.id}>
                        <TableCell className="font-mono font-semibold text-xs">
                          <Link
                            href={fichaHref(animal.id)}
                            className="hover:text-emerald-700 hover:underline underline-offset-2"
                          >
                            {animal.tagId}
                          </Link>
                        </TableCell>
                        <TableCell>{animal.breed}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {animal.sex === "M" ? "M" : "H"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDate(animal.entryDate)}
                        </TableCell>
                        <TableCell>{animal.initialWeight}</TableCell>
                        <TableCell className="font-semibold">
                          {animal.currentWeight}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-emerald-600 text-sm font-medium">
                          +{gain} kg
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {animal.purchasePricePerKg != null
                            ? formatCurrency(animal.purchasePricePerKg)
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span
                            className="text-xs bg-muted px-2 py-0.5 rounded-lg"
                            title={formatModuleLabel(animal.moduleId, animal.moduleName)}
                          >
                            {formatModuleLabel(animal.moduleId, animal.moduleName)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                            {bajaPendiente && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                                Baja pendiente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              href={fichaHref(animal.id)}
                              title="Ver ficha"
                              className="p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground inline-flex"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            {canModify && (
                              <>
                                <ActionBtn
                                  title="Editar"
                                  onClick={() => void openEdit(animal)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </ActionBtn>
                                {!bajaPendiente && (
                                  <ActionBtn
                                    title="Solicitar baja"
                                    onClick={() => openDelete(animal)}
                                    danger
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </ActionBtn>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} de {animals.length} animales
          </p>
        </CardContent>
      </Card>

      <AnimalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        form={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={formError}
        corrales={corrales}
        lockArete={lockArete}
      />

      <AnimalDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleteSuccess(false);
          }
        }}
        animal={deleteTarget}
        onConfirm={confirmDelete}
        submitting={submitting}
        error={deleteError}
        success={deleteSuccess}
      />
    </div>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        danger
          ? "hover:bg-red-50 text-muted-foreground hover:text-red-600"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
