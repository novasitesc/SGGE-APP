"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createHealthAlertApi,
  createMedicamentoApi,
  createTreatmentApi,
  deleteHealthAlertApi,
  deleteMedicamentoApi,
  deleteTreatmentApi,
  fetchHealthAlerts,
  fetchMedicamentos,
  fetchTreatments,
  syncHealthAlertsApi,
  updateHealthAlertApi,
  updateTreatmentApi,
} from "@/lib/api/data-client";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import type { HealthAlert, Treatment } from "@/lib/types/domain";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertaFormDialog,
  ImportPdfDialog,
  SaludHelpPanel,
  TratamientoFormDialog,
  TREATMENT_TYPE_COLORS,
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPES,
  type TreatmentType,
} from "@/modules/salud/client";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronLeft,
  Download,
  FileUp,
  HeartPulse,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  Syringe,
  Trash2,
} from "lucide-react";

type TabType = "tratamientos" | "alertas" | "medicamentos" | "cargas";

const priorityVariant = {
  alta: "destructive" as const,
  media: "warning" as const,
  baja: "secondary" as const,
};

export default function GestionSaludPage() {
  const { data: treatments, reload: reloadTreatments, loading: loadingT } =
    useApiQuery("treatments", fetchTreatments);
  const { data: healthAlerts, reload: reloadAlerts, loading: loadingA } =
    useApiQuery("health-alerts", fetchHealthAlerts);
  const { data: medicamentos, reload: reloadMeds, loading: loadingM } =
    useApiQuery("medicamentos", fetchMedicamentos);

  const refreshSalud = async () => {
    invalidateApiCacheMany(["treatments", "health-alerts", "medicamentos", "dashboard"]);
    await Promise.all([reloadTreatments(), reloadAlerts(), reloadMeds()]);
  };

  const list = treatments ?? [];
  const alerts = healthAlerts ?? [];
  const meds = medicamentos ?? [];

  const [tab, setTab] = useState<TabType>("tratamientos");
  const [q, setQ] = useState("");

  const [tOpen, setTOpen] = useState(false);
  const [tEditing, setTEditing] = useState<Treatment | null>(null);
  const [tDeleteId, setTDeleteId] = useState<string | null>(null);

  const [aOpen, setAOpen] = useState(false);
  const [aEditing, setAEditing] = useState<HealthAlert | null>(null);
  const [aDeleteId, setADeleteId] = useState<string | null>(null);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [medForm, setMedForm] = useState({
    name: "",
    type: "vacuna",
    pricePerUnit: "",
    unit: "dosis",
    periodoCarenciaDias: "",
    manualUso: "",
  });
  const [medBusy, setMedBusy] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  const filteredTreatments = useMemo(() => {
    if (!q.trim()) return list;
    const qq = q.toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(qq) ||
        String(t.type).toLowerCase().includes(qq) ||
        t.appliedBy.toLowerCase().includes(qq)
    );
  }, [list, q]);

  const totalTreatmentCost = list.reduce((s, t) => s + t.totalCost, 0);

  const tabs: { id: TabType; label: string; icon: typeof Syringe }[] = [
    { id: "tratamientos", label: "Tratamientos", icon: Syringe },
    { id: "alertas", label: "Alertas", icon: Bell },
    { id: "medicamentos", label: "Medicamentos", icon: Pill },
    { id: "cargas", label: "Cargas", icon: FileUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/gestion"
            className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-rose-700" />
              <h1 className="text-2xl font-bold tracking-tight">
                Gestión de Salud
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {list.length} tratamientos · {alerts.length} alertas ·{" "}
              <Link href="/health" className="text-teal-700 hover:underline">
                Ver dashboard
              </Link>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm hover:bg-muted"
          >
            <BookOpen className="h-4 w-4" />
            Manual
          </button>
          {tab === "tratamientos" && (
            <button
              type="button"
              onClick={() => {
                setTEditing(null);
                setTOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Nuevo tratamiento
            </button>
          )}
          {tab === "alertas" && (
            <button
              type="button"
              onClick={() => {
                setAEditing(null);
                setAOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Nueva alerta
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tratamientos" && (
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Historial de tratamientos</p>
              <p className="text-xs text-muted-foreground">
                Total invertido:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(totalTreatmentCost)}
                </span>
              </p>
            </div>
            <Input
              className="max-w-xs"
              placeholder="Buscar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden lg:table-cell">Carencia / traslado</TableHead>
                <TableHead className="hidden md:table-cell">Animales</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingT ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filteredTreatments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay tratamientos. Registra uno o importa un PDF.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTreatments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">
                      <div>{t.name}</div>
                      {(t.origen === "pdf" ||
                        t.notes?.includes("comprobante")) && (
                        <span className="text-[10px] uppercase tracking-wide text-sky-700">
                          Origen PDF / comprobante
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                          TREATMENT_TYPE_COLORS[t.type as TreatmentType] ??
                          "bg-muted"
                        }`}
                      >
                        {TREATMENT_TYPE_LABELS[t.type as TreatmentType] ??
                          t.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.date)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {t.fechaFinCarencia ? (
                        <div className="space-y-0.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                              t.listoTraslado
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {t.listoTraslado
                              ? "Listo traslado"
                              : "En carencia"}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Hasta {formatDate(t.fechaFinCarencia)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin carencia</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <div className="space-y-0.5">
                        <span className="font-medium">{t.animalCount}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {(() => {
                            const mod = t.notes?.match(/\[módulo:([^\]]+)\]/);
                            if (mod) return `Módulo ${mod[1]}`;
                            if (t.animalId || t.notes?.includes("arete"))
                              return "Por animal";
                            return "Hato";
                          })()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(t.totalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTEditing(t);
                            setTOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTDeleteId(t.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "alertas" && (
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex justify-between items-center">
            <p className="font-medium text-sm">Alertas sanitarias</p>
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  await syncHealthAlertsApi();
                  await reloadAlerts();
                } finally {
                  setSyncing(false);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 hover:bg-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync desde tratamientos
            </button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Mensaje</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Arete</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingA ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay alertas. Crea una o sincroniza desde tratamientos.
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm max-w-xs">{a.message}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-lg capitalize">
                        {a.type}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {a.tagId ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(a.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[a.priority]}>
                        {a.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAEditing(a);
                            setAOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setADeleteId(a.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "medicamentos" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <form
            className="rounded-2xl border p-4 space-y-3 h-fit"
            onSubmit={async (e) => {
              e.preventDefault();
              setMedBusy(true);
              setMedError(null);
              try {
                await createMedicamentoApi({
                  name: medForm.name,
                  type: medForm.type,
                  unit: medForm.unit,
                  pricePerUnit: Number(medForm.pricePerUnit) || 0,
                  periodoCarenciaDias:
                    Number(medForm.periodoCarenciaDias) || 0,
                  manualUso: medForm.manualUso.trim() || undefined,
                });
                setMedForm({
                  name: "",
                  type: "vacuna",
                  pricePerUnit: "",
                  unit: "dosis",
                  periodoCarenciaDias: "",
                  manualUso: "",
                });
                await reloadMeds();
              } catch (err) {
                setMedError(
                  err instanceof Error ? err.message : "Error al guardar"
                );
              } finally {
                setMedBusy(false);
              }
            }}
          >
            <p className="font-medium text-sm">Alta de medicamento</p>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                required
                value={medForm.name}
                onChange={(e) =>
                  setMedForm({ ...medForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={medForm.type}
                  onChange={(e) =>
                    setMedForm({ ...medForm, type: e.target.value })
                  }
                >
                  {TREATMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TREATMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>₡ / unidad</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={medForm.pricePerUnit}
                  onChange={(e) =>
                    setMedForm({ ...medForm, pricePerUnit: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Días de carencia (manual de uso)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Ej. 14"
                value={medForm.periodoCarenciaDias}
                onChange={(e) =>
                  setMedForm({
                    ...medForm,
                    periodoCarenciaDias: e.target.value,
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Días tras la aplicación hasta que el animal pueda ir a
                subasta/traslado.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nota del manual</Label>
              <Input
                placeholder="Referencia ficha técnica…"
                value={medForm.manualUso}
                onChange={(e) =>
                  setMedForm({ ...medForm, manualUso: e.target.value })
                }
              />
            </div>
            {medError && (
              <p className="text-sm text-rose-600">{medError}</p>
            )}
            <button
              type="submit"
              disabled={medBusy}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-60"
            >
              {medBusy ? "Guardando…" : "Registrar"}
            </button>
          </form>

          <div className="lg:col-span-2 rounded-2xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Carencia</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingM ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : meds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Catálogo vacío.
                    </TableCell>
                  </TableRow>
                ) : (
                  meds.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div>{m.name}</div>
                        {m.manualUso ? (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {m.manualUso}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{m.type}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm tabular-nums">
                        {m.periodoCarenciaDias > 0
                          ? `${m.periodoCarenciaDias} días`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(m.pricePerUnit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteMedicamentoApi(m.id);
                            await reloadMeds();
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "cargas" && (
        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="rounded-2xl border p-6 text-left hover:bg-muted/30 transition-colors space-y-2"
          >
            <FileUp className="h-6 w-6 text-sky-700" />
            <p className="font-semibold">Importar PDF sanitario</p>
            <p className="text-sm text-muted-foreground">
              Extrae texto, revisa campos y confirma la inscripción.
            </p>
          </button>
          <a
            href="/templates/salud-carga.csv"
            download
            className="rounded-2xl border p-6 hover:bg-muted/30 transition-colors space-y-2 block"
          >
            <Download className="h-6 w-6 text-emerald-700" />
            <p className="font-semibold">Plantilla CSV manual</p>
            <p className="text-sm text-muted-foreground">
              Columnas: nombre, tipo, fecha, animales, costo_por_animal,
              aplicado_por, proxima, notas.
            </p>
          </a>
          <button
            type="button"
            onClick={() => {
              setTEditing(null);
              setTOpen(true);
            }}
            className="rounded-2xl border p-6 text-left hover:bg-muted/30 transition-colors space-y-2 md:col-span-2"
          >
            <Syringe className="h-6 w-6 text-rose-700" />
            <p className="font-semibold">Wizard de inscripción manual</p>
            <p className="text-sm text-muted-foreground">
              Formulario completo de tratamiento con generación de alerta por
              próxima dosis.
            </p>
          </button>
        </div>
      )}

      <TratamientoFormDialog
        open={tOpen}
        onOpenChange={setTOpen}
        editing={tEditing}
        onSubmit={async (payload) => {
          if (tEditing) {
            await updateTreatmentApi(tEditing.id, {
              type: payload.type,
              name: payload.name,
              date: payload.date,
              animalCount: payload.animalCount,
              costPerAnimal: payload.costPerAnimal,
              totalCost: payload.totalCost,
              appliedBy: payload.appliedBy,
              notes: payload.notes,
              nextDue: payload.nextDue,
              diasCarencia: payload.diasCarencia,
            });
          } else {
            await createTreatmentApi({
              type: payload.type,
              name: payload.name,
              date: payload.date,
              animalCount: payload.animalCount,
              costPerAnimal: payload.costPerAnimal,
              totalCost: payload.totalCost,
              appliedBy: payload.appliedBy,
              notes: payload.notes,
              nextDue: payload.nextDue,
              diasCarencia: payload.diasCarencia,
              animalId: payload.animalId,
              animalIds: payload.animalIds,
              bulk: Boolean(payload.animalIds && payload.animalIds.length > 1),
            });
          }
          invalidateApiCacheMany(["treatments", "health-alerts", "dashboard"]);
          await reloadTreatments();
          await reloadAlerts();
        }}
      />

      <AlertaFormDialog
        open={aOpen}
        onOpenChange={setAOpen}
        editing={aEditing}
        onSubmit={async (payload) => {
          if (aEditing) {
            await updateHealthAlertApi(aEditing.id, payload);
          } else {
            await createHealthAlertApi(payload);
          }
          invalidateApiCacheMany(["health-alerts", "dashboard"]);
          await reloadAlerts();
        }}
      />

      <ImportPdfDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        onSuccess={() => {
          void refreshSalud();
        }}
      />

      <SaludHelpPanel open={helpOpen} onOpenChange={setHelpOpen} />

      <Dialog open={tDeleteId !== null} onOpenChange={(o) => !o && setTDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar tratamiento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas eliminar este tratamiento? Quedará registrado en
            el historial del sistema.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setTDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!tDeleteId) return;
                await deleteTreatmentApi(tDeleteId);
                setTDeleteId(null);
                invalidateApiCacheMany(["treatments", "dashboard"]);
                await reloadTreatments();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aDeleteId !== null} onOpenChange={(o) => !o && setADeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar alerta
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas eliminar esta alerta?
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setADeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!aDeleteId) return;
                await deleteHealthAlertApi(aDeleteId);
                setADeleteId(null);
                await reloadAlerts();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
