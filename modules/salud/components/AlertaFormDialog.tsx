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
import { Select } from "@/components/ui/select";
import { Bell, Loader2 } from "lucide-react";
import type { HealthAlert } from "@/lib/types/domain";
import type { AlertPrioridad, AlertTipo } from "@/modules/salud/types/salud.types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: HealthAlert | null;
  onSubmit: (payload: {
    type: AlertTipo;
    message: string;
    dueDate: string;
    priority: AlertPrioridad;
    tagId?: string;
  }) => Promise<void>;
};

const empty = {
  tagId: "",
  type: "programado" as AlertTipo,
  message: "",
  dueDate: new Date().toISOString().split("T")[0],
  priority: "media" as AlertPrioridad,
};

export function AlertaFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        tagId: editing.tagId ?? "",
        type: editing.type,
        message: editing.message,
        dueDate: editing.dueDate,
        priority: editing.priority,
      });
    } else {
      setForm(empty);
    }
    setError(null);
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        type: form.type,
        message: form.message.trim(),
        dueDate: form.dueDate,
        priority: form.priority,
        tagId: form.tagId.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            {editing ? "Editar alerta" : "Nueva alerta"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="a-msg">Mensaje *</Label>
            <Input
              id="a-msg"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-type">Tipo</Label>
              <Select
                id="a-type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as AlertTipo })
                }
              >
                <option value="urgente">Urgente</option>
                <option value="programado">Programado</option>
                <option value="revisión">Revisión</option>
                <option value="tratamiento">Tratamiento</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-priority">Prioridad</Label>
              <Select
                id="a-priority"
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as AlertPrioridad,
                  })
                }
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-due">Fecha límite *</Label>
              <Input
                id="a-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-tag">Arete</Label>
              <Input
                id="a-tag"
                placeholder="BV-006"
                value={form.tagId}
                onChange={(e) => setForm({ ...form, tagId: e.target.value })}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Crear alerta"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
