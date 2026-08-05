"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { AnimalDetailView } from "@/components/animales/AnimalDetailView";
import { AnimalPesajesSection } from "@/components/animales/AnimalPesajesSection";
import { AnimalActasSection } from "@/components/animales/AnimalActasSection";
import { AnimalFormDialog } from "@/components/animales/AnimalFormDialog";
import {
  AnimalDeleteDialog,
  type AnimalDeletePayload,
} from "@/components/animales/AnimalDeleteDialog";
import type { AnimalDetail, AnimalFormValues } from "@/components/animales/types";
import {
  EMPTY_ANIMAL_FORM,
  animalToForm,
  formToPayload,
  isFinalStatus,
  validateAnimalForm,
} from "@/components/animales/types";
import { fetchAnimalById, fetchCorrales, updateAnimalApi } from "@/lib/api/animals-client";
import { requestAnimalDeletionApi } from "@/lib/api/solicitudes-client";

type Props = {
  animalId: string;
  backHref?: string;
};

export function AnimalFichaClient({ animalId, backHref = "/gestion/animales" }: Props) {
  const [detail, setDetail] = useState<AnimalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [corrales, setCorrales] = useState<{ id: string; name: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AnimalFormValues>(EMPTY_ANIMAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockArete, setLockArete] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchAnimalById(animalId));
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar la ficha del animal");
    } finally {
      setLoading(false);
    }
  }, [animalId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    fetchCorrales()
      .then((list) => setCorrales(list))
      .catch(() => {});
  }, []);

  const openEdit = () => {
    if (!detail || isFinalStatus(detail.status)) return;
    setForm(animalToForm(detail, detail.sale, detail.purchase));
    setLockArete(!detail.permissions.canChangeArete);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateAnimalForm(form, "edit");
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateAnimalApi(animalId, formToPayload(form));
      setFormOpen(false);
      await loadDetail();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (payload: AnimalDeletePayload) => {
    setSubmitting(true);
    setDeleteError(null);
    try {
      await requestAnimalDeletionApi(animalId, payload);
      setDeleteSuccess(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al enviar solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const canModify = detail && !isFinalStatus(detail.status);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href={backHref}
            className="flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-muted transition-colors shrink-0 mt-0.5"
            title="Volver al inventario"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 sm:text-3xl">
              <Eye className="h-6 w-6 text-emerald-600 shrink-0" />
              Ficha de animal
            </h1>
            <p className="text-sm text-muted-foreground mt-1 truncate sm:text-base">
              {detail
                ? `${detail.tagId} · ${detail.breed}`
                : loading
                  ? "Cargando..."
                  : "Animal no encontrado"}
            </p>
          </div>
        </div>

        {detail && canModify && (
          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {detail.permissions.canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteSuccess(false);
                  setDeleteOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Solicitar baja
              </button>
            )}
            {detail.permissions.canEdit && (
              <button
                type="button"
                onClick={openEdit}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2 text-base">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando ficha...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center space-y-4">
          <p className="text-red-700">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadDetail()}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
            <Link
              href={backHref}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Volver al inventario
            </Link>
          </div>
        </div>
      ) : detail ? (
        <>
          <AnimalDetailView detail={detail} />
          <AnimalPesajesSection detail={detail} />
          <AnimalActasSection
            animalId={animalId}
            actas={detail.actas ?? []}
            canAdd={detail.status !== "muerto"}
            onUpdated={loadDetail}
          />
        </>
      ) : null}

      {detail && (
        <>
          <AnimalFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            mode="edit"
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
                setDeleteError(null);
                setDeleteSuccess(false);
              }
            }}
            animal={detail}
            onConfirm={confirmDelete}
            submitting={submitting}
            error={deleteError}
            success={deleteSuccess}
          />
        </>
      )}
    </div>
  );
}
