"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createTreatmentApi,
  fetchHealthAlerts,
  fetchTreatments,
  updateHealthAlertApi,
} from "@/lib/api/data-client";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  Download,
  FileDown,
  HeartPulse,
  Pill,
  Settings2,
  Shield,
  Syringe,
} from "lucide-react";
import {
  ChartSalud,
  computeSaludKpis,
  SaludHelpPanel,
  TREATMENT_TYPE_COLORS,
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPES,
  type TreatmentType,
} from "@/modules/salud/client";

const priorityVariant = {
  alta: "destructive" as const,
  media: "warning" as const,
  baja: "secondary" as const,
};

export default function HealthPage() {
  const { data: treatments, loading: loadingT, reload: reloadT } =
    useApiQuery("treatments", fetchTreatments);
  const { data: healthAlerts, loading: loadingA, reload: reloadA } =
    useApiQuery("health-alerts", fetchHealthAlerts);
  const list = treatments ?? [];
  const alerts = healthAlerts ?? [];

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay =
          t.name.toLowerCase().includes(qq) ||
          t.appliedBy.toLowerCase().includes(qq) ||
          String(t.type).toLowerCase().includes(qq) ||
          t.notes.toLowerCase().includes(qq);
        if (!hay) return false;
      }
      return true;
    });
  }, [list, typeFilter, from, to, q]);

  const kpis = useMemo(() => {
    const base = computeSaludKpis(filtered);
    return {
      ...base,
      activeAlertsHigh: alerts.filter((a) => a.priority === "alta").length,
    };
  }, [filtered, alerts]);

  const resolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await updateHealthAlertApi(id, { status: "resuelta" });
      invalidateApiCacheMany(["health-alerts", "dashboard"]);
      await reloadA();
    } finally {
      setResolvingId(null);
    }
  };

  const createFromAlert = async (alertId: string) => {
    const a = alerts.find((x) => x.id === alertId);
    if (!a) return;
    await createTreatmentApi({
      type: "vacuna",
      name: a.message.slice(0, 80),
      date: new Date().toISOString().slice(0, 10),
      animalCount: 1,
      costPerAnimal: 0,
      notes: `Creado desde alerta: ${a.message}`,
      nextDue: undefined,
    });
    await updateHealthAlertApi(alertId, { status: "resuelta" });
    invalidateApiCacheMany(["treatments", "health-alerts", "dashboard"]);
    await Promise.all([reloadT(), reloadA()]);
  };

  const exportHref = (format: "html" | "csv") => {
    const qs = new URLSearchParams({ format });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return `/api/salud/export?${qs.toString()}`;
  };

  const loading = loadingT || loadingA;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-50 via-background to-amber-50/40 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-800 mb-2">
              <HeartPulse className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                SGGE Salud
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Control sanitario
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Trazabilidad de tratamientos, alertas y costos del hato.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-background/80 px-3 py-2 text-sm hover:bg-muted"
            >
              <BookOpen className="h-4 w-4" />
              Manual
            </button>
            <a
              href={exportHref("csv")}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-background/80 px-3 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
            <a
              href={exportHref("html")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border bg-background/80 px-3 py-2 text-sm hover:bg-muted"
            >
              <FileDown className="h-4 w-4" />
              Informe PDF
            </a>
            <Link
              href="/gestion/salud"
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 text-white px-3 py-2 text-sm font-medium hover:bg-teal-900"
            >
              <Settings2 className="h-4 w-4" />
              Gestionar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Tratamientos",
            value: kpis.treatmentsCount,
            icon: Syringe,
            tone: "text-teal-800 bg-teal-50",
          },
          {
            label: "Alertas altas",
            value: kpis.activeAlertsHigh,
            icon: AlertTriangle,
            tone: "text-rose-700 bg-rose-50",
          },
          {
            label: "Vacunas",
            value: kpis.vaccinesApplied,
            icon: Shield,
            tone: "text-sky-800 bg-sky-50",
          },
          {
            label: "Costo sanitario",
            value: formatCurrency(kpis.totalCost),
            icon: Pill,
            tone: "text-amber-800 bg-amber-50",
            isText: true,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border px-4 py-4 bg-background"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.tone}`}
              >
                <kpi.icon className="h-4.5 w-4.5 h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold tabular-nums">
                  {loading ? "…" : kpi.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-5 space-y-4">
        <h2 className="text-base font-semibold">Exploración</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Buscar medicamento, tipo, notas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TREATMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TREATMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Desde"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>
        <ChartSalud trend={kpis.trendByMonth} costByType={kpis.costByType} />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Alertas accionables
          </h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border px-4 py-8 text-center">
              No hay alertas activas.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border px-4 py-3 space-y-2 bg-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">
                      {a.message}
                    </p>
                    <Badge variant={priorityVariant[a.priority]}>
                      {a.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Vence {formatDate(a.dueDate)}
                    {a.tagId ? ` · ${a.tagId}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={resolvingId === a.id}
                      onClick={() => void resolveAlert(a.id)}
                      className="inline-flex items-center gap-1 text-xs rounded-lg border px-2.5 py-1.5 hover:bg-muted"
                    >
                      <Check className="h-3 w-3" />
                      Resolver
                    </button>
                    <button
                      type="button"
                      onClick={() => void createFromAlert(a.id)}
                      className="inline-flex items-center gap-1 text-xs rounded-lg border px-2.5 py-1.5 hover:bg-muted"
                    >
                      <Syringe className="h-3 w-3" />
                      Crear tratamiento
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {kpis.upcomingDue.length > 0 && (
            <div className="pt-2">
              <h3 className="text-sm font-medium mb-2">Próximas aplicaciones</h3>
              <ul className="space-y-1.5">
                {kpis.upcomingDue.map((u) => (
                  <li
                    key={u.id}
                    className="text-sm flex justify-between gap-2 border-b border-dashed py-1.5"
                  >
                    <span>{u.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(u.nextDue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="lg:col-span-3 rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-base font-semibold">Historial filtrado</h2>
            <span className="text-xs text-muted-foreground">
              {filtered.length} registros
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden md:table-cell">Animales</TableHead>
                <TableHead className="hidden lg:table-cell">Próxima</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No hay tratamientos con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">
                      <div>
                        {t.name}
                        {t.animalId && (
                          <Link
                            href={`/gestion/animales/${t.animalId}`}
                            className="block text-xs text-teal-700 hover:underline mt-0.5"
                          >
                            Ver animal
                          </Link>
                        )}
                      </div>
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
                    <TableCell className="hidden md:table-cell text-sm">
                      {t.animalCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {t.nextDue ? formatDate(t.nextDue) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(t.totalCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>

      <SaludHelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
