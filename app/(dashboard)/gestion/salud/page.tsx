"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { TreatmentType } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  HeartPulse,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  Syringe,
  Bell,
} from "lucide-react";

type TabType = "tratamientos" | "alertas";

const treatmentTypeLabel: Record<TreatmentType, string> = {
  vacuna: "Vacuna",
  desparasitante: "Desparasitante",
  implante: "Implante",
  anabólico: "Anabólico",
  vitamina: "Vitamina",
  antibiótico: "Antibiótico",
};

const treatmentTypeColor: Record<TreatmentType, string> = {
  vacuna: "bg-purple-100 text-purple-700",
  desparasitante: "bg-amber-100 text-amber-700",
  implante: "bg-blue-100 text-blue-700",
  anabólico: "bg-cyan-100 text-cyan-700",
  vitamina: "bg-lime-100 text-lime-700",
  antibiótico: "bg-red-100 text-red-700",
};

const priorityVariant = {
  alta: "destructive" as const,
  media: "warning" as const,
  baja: "secondary" as const,
};

const emptyTreatmentForm = {
  type: "vacuna" as TreatmentType,
  name: "",
  date: new Date().toISOString().split("T")[0],
  animalCount: "",
  costPerAnimal: "",
  totalCost: "",
  appliedBy: "",
  notes: "",
  nextDue: "",
};

const emptyAlertForm = {
  tagId: "",
  type: "programado" as "tratamiento" | "revisión" | "urgente" | "programado",
  message: "",
  dueDate: new Date().toISOString().split("T")[0],
  priority: "media" as "alta" | "media" | "baja",
};

export default function GestionSaludPage() {
  const { treatments, addTreatment, updateTreatment, removeTreatment,
    healthAlerts, addHealthAlert, updateHealthAlert, removeHealthAlert } = useStore();

  const [tab, setTab] = useState<TabType>("tratamientos");

  // Treatment state
  const [tDialogOpen, setTDialogOpen] = useState(false);
  const [tEditingId, setTEditingId] = useState<string | null>(null);
  const [tForm, setTForm] = useState(emptyTreatmentForm);
  const [tDeleteId, setTDeleteId] = useState<string | null>(null);

  // Alert state
  const [aDialogOpen, setADialogOpen] = useState(false);
  const [aEditingId, setAEditingId] = useState<string | null>(null);
  const [aForm, setAForm] = useState(emptyAlertForm);
  const [aDeleteId, setADeleteId] = useState<string | null>(null);

  // Treatment handlers
  const openAddTreatment = () => {
    setTEditingId(null);
    setTForm(emptyTreatmentForm);
    setTDialogOpen(true);
  };

  const openEditTreatment = (id: string) => {
    const t = treatments.find((t) => t.id === id);
    if (!t) return;
    setTEditingId(id);
    setTForm({
      type: t.type,
      name: t.name,
      date: t.date,
      animalCount: String(t.animalCount),
      costPerAnimal: String(t.costPerAnimal),
      totalCost: String(t.totalCost),
      appliedBy: t.appliedBy,
      notes: t.notes,
      nextDue: t.nextDue ?? "",
    });
    setTDialogOpen(true);
  };

  const handleTreatmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: tForm.type,
      name: tForm.name,
      date: tForm.date,
      animalCount: Number(tForm.animalCount),
      costPerAnimal: Number(tForm.costPerAnimal),
      totalCost: Number(tForm.totalCost),
      appliedBy: tForm.appliedBy,
      notes: tForm.notes,
      nextDue: tForm.nextDue || undefined,
    };
    if (tEditingId) {
      updateTreatment(tEditingId, payload);
    } else {
      addTreatment(payload);
    }
    setTDialogOpen(false);
  };

  // Alert handlers
  const openAddAlert = () => {
    setAEditingId(null);
    setAForm(emptyAlertForm);
    setADialogOpen(true);
  };

  const openEditAlert = (id: string) => {
    const a = healthAlerts.find((a) => a.id === id);
    if (!a) return;
    setAEditingId(id);
    setAForm({
      tagId: a.tagId ?? "",
      type: a.type,
      message: a.message,
      dueDate: a.dueDate,
      priority: a.priority,
    });
    setADialogOpen(true);
  };

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tagId: aForm.tagId || undefined,
      type: aForm.type,
      message: aForm.message,
      dueDate: aForm.dueDate,
      priority: aForm.priority,
    };
    if (aEditingId) {
      updateHealthAlert(aEditingId, payload);
    } else {
      addHealthAlert(payload);
    }
    setADialogOpen(false);
  };

  const totalTreatmentCost = treatments.reduce((s, t) => s + t.totalCost, 0);

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
              <HeartPulse className="h-5 w-5 text-red-600" />
              <h1 className="text-2xl font-bold tracking-tight">Gestión de Salud</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {treatments.length} tratamientos · {healthAlerts.length} alertas activas
            </p>
          </div>
        </div>
        {tab === "tratamientos" ? (
          <button
            onClick={openAddTreatment}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Tratamiento
          </button>
        ) : (
          <button
            onClick={openAddAlert}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Alerta
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(["tratamientos", "alertas"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "tratamientos" ? <Syringe className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {t === "tratamientos" ? "Tratamientos" : "Alertas"}
          </button>
        ))}
      </div>

      {/* ─── TRATAMIENTOS ─────────────────────────────────────────────── */}
      {tab === "tratamientos" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-red-600" />
                Historial de tratamientos
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                Total invertido: <span className="font-semibold text-foreground">{formatCurrency(totalTreatmentCost)}</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden md:table-cell">Animales</TableHead>
                  <TableHead className="hidden md:table-cell">Aplicado por</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treatments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay tratamientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  treatments.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${treatmentTypeColor[t.type]}`}>
                          {treatmentTypeLabel[t.type]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(t.date)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{t.animalCount}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{t.appliedBy}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.totalCost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditTreatment(t.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setTDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600" title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── ALERTAS ──────────────────────────────────────────────────── */}
      {tab === "alertas" && (
        <Card>
          <CardContent className="pt-6">
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
                {healthAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay alertas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  healthAlerts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm max-w-xs">{a.message}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-lg capitalize">{a.type}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs">{a.tagId ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(a.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant[a.priority]}>{a.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditAlert(a.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setADeleteId(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600" title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Treatment Dialog */}
      <Dialog open={tDialogOpen} onOpenChange={setTDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-red-600" />
              {tEditingId ? "Editar Tratamiento" : "Nuevo Tratamiento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTreatmentSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Nombre *</Label>
              <Input id="t-name" placeholder="Vacuna Triple Viral" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-type">Tipo</Label>
                <Select id="t-type" value={tForm.type} onChange={(e) => setTForm({ ...tForm, type: e.target.value as TreatmentType })}>
                  {(Object.keys(treatmentTypeLabel) as TreatmentType[]).map((t) => (
                    <option key={t} value={t}>{treatmentTypeLabel[t]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-date">Fecha *</Label>
                <Input id="t-date" type="date" value={tForm.date} onChange={(e) => setTForm({ ...tForm, date: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-count">Animales</Label>
                <Input id="t-count" type="number" min="1" placeholder="18" value={tForm.animalCount} onChange={(e) => setTForm({ ...tForm, animalCount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-cpa">$/animal</Label>
                <Input id="t-cpa" type="number" min="0" step="0.01" placeholder="200" value={tForm.costPerAnimal} onChange={(e) => setTForm({ ...tForm, costPerAnimal: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-total">Total ($)</Label>
                <Input id="t-total" type="number" min="0" step="0.01" placeholder="3600" value={tForm.totalCost} onChange={(e) => setTForm({ ...tForm, totalCost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-by">Aplicado por</Label>
              <Input id="t-by" placeholder="Dr. Hernández" value={tForm.appliedBy} onChange={(e) => setTForm({ ...tForm, appliedBy: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-notes">Notas</Label>
              <Input id="t-notes" placeholder="Observaciones del tratamiento" value={tForm.notes} onChange={(e) => setTForm({ ...tForm, notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-next">Próxima aplicación (opcional)</Label>
              <Input id="t-next" type="date" value={tForm.nextDue} onChange={(e) => setTForm({ ...tForm, nextDue: e.target.value })} />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setTDialogOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                {tEditingId ? "Guardar cambios" : "Registrar"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={aDialogOpen} onOpenChange={setADialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              {aEditingId ? "Editar Alerta" : "Nueva Alerta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlertSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-msg">Mensaje *</Label>
              <Input id="a-msg" placeholder="Describir la alerta..." value={aForm.message} onChange={(e) => setAForm({ ...aForm, message: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-type">Tipo</Label>
                <Select id="a-type" value={aForm.type} onChange={(e) => setAForm({ ...aForm, type: e.target.value as typeof aForm.type })}>
                  <option value="urgente">Urgente</option>
                  <option value="programado">Programado</option>
                  <option value="revisión">Revisión</option>
                  <option value="tratamiento">Tratamiento</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-priority">Prioridad</Label>
                <Select id="a-priority" value={aForm.priority} onChange={(e) => setAForm({ ...aForm, priority: e.target.value as typeof aForm.priority })}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-due">Fecha límite *</Label>
                <Input id="a-due" type="date" value={aForm.dueDate} onChange={(e) => setAForm({ ...aForm, dueDate: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-tag">Arete (opcional)</Label>
                <Input id="a-tag" placeholder="BV-006" value={aForm.tagId} onChange={(e) => setAForm({ ...aForm, tagId: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setADialogOpen(false)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                {aEditingId ? "Guardar cambios" : "Crear alerta"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirms */}
      <Dialog open={tDeleteId !== null} onOpenChange={(o) => !o && setTDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar tratamiento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Seguro que deseas eliminar este tratamiento?</p>
          <DialogFooter>
            <button onClick={() => setTDeleteId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => { if (tDeleteId) removeTreatment(tDeleteId); setTDeleteId(null); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Eliminar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aDeleteId !== null} onOpenChange={(o) => !o && setADeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar alerta
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Seguro que deseas eliminar esta alerta?</p>
          <DialogFooter>
            <button onClick={() => setADeleteId(null)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => { if (aDeleteId) removeHealthAlert(aDeleteId); setADeleteId(null); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Eliminar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
