"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { BookOpen, Loader2, Plus, ScrollText, User } from "lucide-react";
import type { ActaRecord } from "@/components/animales/types";
import { createActaAnimal } from "@/lib/api/animals-client";

type Props = {
  animalId: string;
  actas: ActaRecord[];
  canAdd: boolean;
  onUpdated: () => void | Promise<void>;
};

export function AnimalActasSection({ animalId, actas, canAdd, onUpdated }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");
  const [autorNombre, setAutorNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) {
      setError("Escriba la observación o nota del acta.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createActaAnimal(animalId, {
        fecha,
        texto: texto.trim(),
        autorNombre: autorNombre.trim() || undefined,
      });
      setTexto("");
      setAutorNombre("");
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el acta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:px-6 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Registro de actas</h2>
            <p className="text-sm text-muted-foreground">
              Observaciones fechadas para el control del animal
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {actas.length} {actas.length === 1 ? "entrada" : "entradas"}
        </span>
      </button>

      {expanded && (
        <div className="p-5 sm:p-6 space-y-6 border-t">
          {canAdd && (
            <form onSubmit={handleSubmit} className="rounded-xl border bg-muted/10 p-4 sm:p-5 space-y-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-600" />
                Nueva entrada
              </p>
              <div className="grid sm:grid-cols-[160px_1fr] gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="acta-fecha" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Fecha
                  </label>
                  <input
                    id="acta-fecha"
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full text-sm rounded-xl border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="acta-autor" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Registrado por (opcional)
                  </label>
                  <input
                    id="acta-autor"
                    type="text"
                    placeholder="Nombre del responsable"
                    value={autorNombre}
                    onChange={(e) => setAutorNombre(e.target.value)}
                    className="w-full text-sm rounded-xl border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="acta-texto" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Observación / acta
                </label>
                <textarea
                  id="acta-texto"
                  rows={3}
                  required
                  placeholder="Ej.: Revisión veterinaria, cambio de corral, comportamiento, tratamiento..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full text-sm rounded-xl border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[88px]"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Registrar acta
                </button>
              </div>
            </form>
          )}

          {actas.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground space-y-2">
              <ScrollText className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm">Sin actas registradas para este animal.</p>
              {canAdd && (
                <p className="text-xs">Use el formulario superior para agregar la primera observación.</p>
              )}
            </div>
          ) : (
            <ol className="relative space-y-0">
              {actas.map((acta, index) => (
                <li key={acta.id} className="relative pl-8 pb-6 last:pb-0">
                  {index < actas.length - 1 && (
                    <span
                      className="absolute left-[11px] top-6 bottom-0 w-px bg-border"
                      aria-hidden
                    />
                  )}
                  <span className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  <article className="rounded-xl border bg-background p-4 hover:border-emerald-200/80 transition-colors">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                      <time
                        dateTime={acta.fecha}
                        className="text-sm font-semibold text-emerald-800"
                      >
                        {formatDate(acta.fecha)}
                      </time>
                      {acta.autorNombre && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {acta.autorNombre}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        Registrado {formatDate(acta.createdAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {acta.texto}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
