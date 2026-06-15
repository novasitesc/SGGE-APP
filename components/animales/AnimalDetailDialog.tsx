"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import type { AnimalDetail } from "@/components/animales/types";
import { AnimalDetailView } from "@/components/animales/AnimalDetailView";
import { AnimalPesajesSection } from "@/components/animales/AnimalPesajesSection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AnimalDetail | null;
  loading: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function AnimalDetailDialog({
  open,
  onOpenChange,
  detail,
  loading,
  onEdit,
  onDelete,
}: Props) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[min(72rem,96vw)] max-h-[92vh] overflow-y-auto p-6 sm:p-8 lg:p-10">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2.5 text-2xl">
            <Eye className="h-6 w-6 text-emerald-600" />
            Ficha de animal
          </DialogTitle>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-base">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-6">
            <AnimalDetailView detail={detail} />
            <AnimalPesajesSection detail={detail} compact />
            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
              {detail.permissions.canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-base font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              )}
              {detail.permissions.canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 ml-auto"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
