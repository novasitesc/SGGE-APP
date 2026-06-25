"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader2, User } from "lucide-react";
import type { Animal } from "@/lib/mockData";
import {
  validarDatosSolicitante,
  validarJustificacionEliminacion,
} from "@/lib/api/aprobacion";
import type { AnimalDeleteRequestPayload } from "@/lib/api/solicitudes-client";

export type AnimalDeletePayload = AnimalDeleteRequestPayload;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal: Animal | null;
  submitting: boolean;
  error: string | null;
  success: boolean;
  onConfirm: (payload: AnimalDeletePayload) => void;
};

export function AnimalDeleteDialog({
  open,
  onOpenChange,
  animal,
  submitting,
  error,
  success,
  onConfirm,
}: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setFormError(null);
  }, [open]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const fd = new FormData(e.currentTarget);
    const justification = String(fd.get("justification") ?? "");
    const requesterName = String(fd.get("requesterName") ?? "");
    const requesterEmail = String(fd.get("requesterEmail") ?? "");
    const requesterRole = String(fd.get("requesterRole") ?? "");

    const justificationError = validarJustificacionEliminacion(justification);
    if (justificationError) {
      setFormError(justificationError);
      return;
    }

    const solicitanteError = validarDatosSolicitante({
      nombre: requesterName,
      email: requesterEmail,
      cargo: requesterRole,
    });
    if (solicitanteError) {
      setFormError(solicitanteError);
      return;
    }

    onConfirm({
      justification: justification.trim(),
      requesterName: requesterName.trim(),
      requesterEmail: requesterEmail.trim() || undefined,
      requesterRole: requesterRole.trim() || undefined,
    });
  };

  const displayError = formError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Solicitud de baja de animal
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">Solicitud enviada</p>
                <p className="text-emerald-800 mt-1 leading-relaxed">
                  La baja del animal <strong className="font-mono">{animal?.tagId}</strong> quedó
                  pendiente de aprobación. El gerente la revisará en{" "}
                  <strong>Mensajería</strong>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Entendido
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              La eliminación del animal <strong className="font-mono">{animal?.tagId}</strong>{" "}
              requiere justificación y aprobación del gerente. Complete los datos y envíe la
              solicitud; quedará registrada en el historial.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="justification">Justificación de la baja *</Label>
              <textarea
                id="justification"
                name="justification"
                rows={4}
                required
                minLength={20}
                placeholder="Describa el motivo: error de registro, traslado, duplicado, etc."
                className="w-full text-sm rounded-xl border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <p className="text-[11px] text-muted-foreground">Mínimo 20 caracteres.</p>
            </div>

            <div className="rounded-xl border bg-muted/40 p-3 space-y-3">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Datos de quien solicita
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="requesterName">Nombre completo *</Label>
                <Input
                  id="requesterName"
                  name="requesterName"
                  placeholder="Ej. Juan Pérez"
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requesterEmail">Correo</Label>
                <Input
                  id="requesterEmail"
                  name="requesterEmail"
                  type="email"
                  placeholder="operador@srrg.demo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requesterRole">Cargo / puesto</Label>
                <Input
                  id="requesterRole"
                  name="requesterRole"
                  placeholder="Ej. Operador de corral"
                />
              </div>
            </div>

            {displayError && <p className="text-sm text-red-600">{displayError}</p>}

            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar solicitud
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
