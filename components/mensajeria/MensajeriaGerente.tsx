"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPendingSolicitudesCount,
  fetchSolicitudes,
  resolveSolicitudApi,
  type SolicitudAprobacion,
} from "@/lib/api/solicitudes-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_CONFIG = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  aprobada: { label: "Aprobada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rechazada: { label: "Rechazada", className: "bg-red-100 text-red-800 border-red-200" },
} as const;

type Props = {
  title?: string;
  subtitle?: string;
  showBackLink?: React.ReactNode;
};

export function MensajeriaGerente({
  title = "Mensajería — Aprobaciones",
  subtitle,
  showBackLink,
}: Props) {
  const [items, setItems] = useState<SolicitudAprobacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"pendiente" | "todas">("pendiente");
  const [selected, setSelected] = useState<SolicitudAprobacion | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<"aprobar" | "rechazar">("aprobar");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSolicitudes({ estado: filtro === "pendiente" ? "pendiente" : "todas" });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  const openResolve = (item: SolicitudAprobacion, action: "aprobar" | "rechazar") => {
    setSelected(item);
    setResolveAction(action);
    setApproverEmail("");
    setApproverPassword("");
    setNotes("");
    setResolveError(null);
    setResolveOpen(true);
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setResolveError(null);
    try {
      await resolveSolicitudApi(selected.id, {
        action: resolveAction,
        approverEmail,
        approverPassword,
        notes: notes.trim() || undefined,
      });
      setResolveOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Error al resolver solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const pendientes = items.filter((i) => i.status === "pendiente").length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => void load()} className="ml-auto underline text-xs">
            Reintentar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {showBackLink}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle ??
                "Bandeja del gerente: revise y apruebe o rechace solicitudes sensibles."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as "pendiente" | "todas")}
            className="text-sm rounded-xl border px-3 py-2 bg-background"
          >
            <option value="pendiente">Solo pendientes</option>
            <option value="todas">Todas</option>
          </select>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {filtro === "pendiente" && pendientes > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pendientes}</strong> solicitud{pendientes !== 1 ? "es" : ""} pendiente
          {pendientes !== 1 ? "s" : ""} de aprobación.
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando mensajería…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Sin solicitudes {filtro === "pendiente" ? "pendientes" : ""}</p>
            <p className="text-sm mt-1">Las bajas de animales aparecerán aquí para su revisión.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline">{item.typeLabel}</Badge>
                        <span className="font-mono font-semibold">{item.reference}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                    {item.status === "pendiente" && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openResolve(item, "aprobar")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => openResolve(item, "rechazar")}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Justificación
                    </p>
                    <p className="mt-1 leading-relaxed">{item.justification}</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Solicitante</p>
                        <p className="font-medium">{item.requesterName}</p>
                        {item.requesterRole && (
                          <p className="text-xs text-muted-foreground">{item.requesterRole}</p>
                        )}
                      </div>
                    </div>
                    {item.requesterEmail && (
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Correo</p>
                          <p>{item.requesterEmail}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {item.status !== "pendiente" && (
                    <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      {item.status === "aprobada" ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprobada por {item.approverName ?? "gerente"}
                          {item.resolvedAt && ` · ${formatDate(item.resolvedAt)}`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Rechazada por {item.approverName ?? "gerente"}
                          {item.resolutionNotes && `: ${item.resolutionNotes}`}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resolveAction === "aprobar" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {resolveAction === "aprobar" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <form onSubmit={handleResolve} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {resolveAction === "aprobar" ? (
                  <>
                    Al aprobar se ejecutará la baja del animal{" "}
                    <strong className="font-mono">{selected.reference}</strong> y quedará en el
                    historial.
                  </>
                ) : (
                  <>
                    Rechazar la baja del animal{" "}
                    <strong className="font-mono">{selected.reference}</strong>. El animal permanece
                    en inventario.
                  </>
                )}
              </p>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 space-y-3">
                <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Credenciales del gerente
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="approverEmail">Correo *</Label>
                  <Input
                    id="approverEmail"
                    type="email"
                    value={approverEmail}
                    onChange={(e) => setApproverEmail(e.target.value)}
                    placeholder="gerente@srrg.demo"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approverPassword">Contraseña *</Label>
                  <Input
                    id="approverPassword"
                    type="password"
                    value={approverPassword}
                    onChange={(e) => setApproverPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  {resolveAction === "rechazar" ? "Motivo del rechazo" : "Notas (opcional)"}
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm rounded-xl border bg-background px-3 py-2"
                  placeholder={
                    resolveAction === "rechazar"
                      ? "Indique por qué se rechaza la solicitud"
                      : "Comentario adicional"
                  }
                />
              </div>

              {resolveError && <p className="text-sm text-red-600">{resolveError}</p>}

              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setResolveOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2 ${
                    resolveAction === "aprobar"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function usePendingSolicitudesCount(pollMs = 60000) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount(await fetchPendingSolicitudesCount());
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { count, refresh };
}
