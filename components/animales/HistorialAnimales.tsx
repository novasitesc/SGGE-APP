"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  User,
  Clock,
  RefreshCw,
  Beef,
  Grid3X3,
  ShoppingCart,
  DollarSign,
  Wheat,
  Warehouse,
  HeartPulse,
  BookOpen,
  Zap,
  Building2,
  Wallet,
  MapPin,
} from "lucide-react";
import { useHistorialSistema } from "@/lib/hooks/useHistorialAnimales";
import {
  ACTION_CONFIG,
  EMPTY_HISTORIAL_FILTERS,
  MODULO_OPTIONS,
  type HistorialAccion,
  type HistorialEntry,
  type HistorialModulo,
} from "@/components/animales/historial-types";

type Props = {
  title?: string;
  subtitle?: string;
  showBackLink?: React.ReactNode;
  headerExtra?: React.ReactNode;
  defaultModulo?: string;
  /** Filtra el historial a un registro concreto (p. ej. UUID del corral). */
  registroId?: string;
  /** Oculta el selector de módulo y compacta el encabezado. */
  compact?: boolean;
};

const ACCIONES: { value: HistorialAccion | ""; label: string }[] = [
  { value: "", label: "Todas las acciones" },
  { value: "crear", label: "Altas" },
  { value: "modificar", label: "Modificaciones" },
  { value: "eliminar", label: "Eliminaciones" },
  { value: "vender", label: "Ventas (animal)" },
  { value: "pesaje", label: "Pesajes" },
  { value: "acta", label: "Actas / observaciones" },
];

const MODULO_ICON: Record<
  HistorialModulo,
  React.ComponentType<{ className?: string }>
> = {
  animales: Beef,
  modulos: Grid3X3,
  ventas: ShoppingCart,
  costos: DollarSign,
  alimentacion: Wheat,
  bodega: Warehouse,
  salud: HeartPulse,
  contabilidad: BookOpen,
  servicios_publicos: Zap,
  polizas: Shield,
  ccss: Building2,
  salarios: Wallet,
  viaticos: MapPin,
};

export function HistorialSistema({
  title = "Historial del sistema",
  subtitle,
  showBackLink,
  headerExtra,
  defaultModulo = "",
  registroId,
  compact = false,
}: Props) {
  const {
    items,
    total,
    loading,
    error,
    filters,
    page,
    totalPages,
    setPage,
    applyFilters,
    reload,
  } = useHistorialSistema({ defaultModulo, registroId });

  const [draft, setDraft] = useState({ ...EMPTY_HISTORIAL_FILTERS, modulo: defaultModulo });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const countsByModule = useMemo(() => {
    const c: Partial<Record<HistorialModulo, number>> = {};
    for (const item of items) {
      c[item.module] = (c[item.module] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(draft);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">No se pudo cargar el historial</p>
            <p className="text-amber-800/80 mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => void reload()} className="underline text-xs shrink-0">
            Reintentar
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {showBackLink}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              {compact ? (
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {subtitle ??
                  "Libro de actas — animales, módulos, ventas, costos, alimentación y más"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          <button
            type="button"
            onClick={() => void reload()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {!compact && (
        <>
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/50 p-4 flex gap-3">
            <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-950/90">
              <p className="font-medium">Trazabilidad transversal del ERP</p>
              <p className="text-indigo-800/70 mt-0.5 leading-relaxed">
                Registro permanente e inmutable: no se puede borrar ni limpiar. Los filtros
                solo acotan la consulta; todo el historial permanece en la base de datos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <StatChip label="Total" value={total} accent="bg-slate-100 text-slate-800" />
            {MODULO_OPTIONS.filter((m) => m.value).map(({ value, label }) => (
              <StatChip
                key={value}
                label={label.split(" ")[0]}
                value={countsByModule[value as HistorialModulo] ?? 0}
                accent="bg-white border text-muted-foreground"
              />
            ))}
          </div>
        </>
      )}

      {compact && (
        <div className="text-sm text-muted-foreground">
          {total} evento{total === 1 ? "" : "s"} registrado{total === 1 ? "" : "s"}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <form onSubmit={handleSearch} className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Referencia (arete, concepto, corral...)"
                className="pl-9 pr-4 py-2 w-full text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={draft.referencia}
                onChange={(e) => setDraft({ ...draft, referencia: e.target.value })}
              />
            </div>
            {!defaultModulo && (
              <select
                value={draft.modulo}
                onChange={(e) => setDraft({ ...draft, modulo: e.target.value })}
                className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
              >
                {MODULO_OPTIONS.map((m) => (
                  <option key={m.value || "all"} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={draft.accion}
                onChange={(e) => setDraft({ ...draft, accion: e.target.value })}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none min-w-[160px]"
              >
                {ACCIONES.map((a) => (
                  <option key={a.value || "all"} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="date"
              title="Desde"
              className="px-3 py-2 text-sm rounded-xl border bg-background"
              value={draft.desde}
              onChange={(e) => setDraft({ ...draft, desde: e.target.value })}
            />
            <input
              type="date"
              title="Hasta"
              className="px-3 py-2 text-sm rounded-xl border bg-background"
              value={draft.hasta}
              onChange={(e) => setDraft({ ...draft, hasta: e.target.value })}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Filtrar
            </button>
          </form>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando libro de actas...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Sin registros</p>
              <p className="text-sm mt-1">
                Los eventos aparecerán al operar en cualquier módulo del sistema.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((entry) => (
                <HistorialRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                />
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {total} evento{total !== 1 ? "s" : ""} · Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Alias para compatibilidad con rutas de animales */
export const HistorialAnimales = HistorialSistema;

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent}`}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-medium mt-0.5 opacity-80 truncate">{label}</p>
    </div>
  );
}

function HistorialRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: HistorialEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = ACTION_CONFIG[entry.action];
  const ModIcon = MODULO_ICON[entry.module] ?? ScrollText;
  const hasDetails = entry.previousData || entry.newData;

  return (
    <li
      className={`rounded-xl border transition-colors ${cfg.border} ${expanded ? cfg.bg : "bg-card hover:bg-muted/30"}`}
    >
      <button
        type="button"
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full text-left p-4 ${hasDetails ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.color}`}
          >
            <ModIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono font-bold text-sm">{entry.reference}</span>
              <Badge variant="outline" className="text-[10px]">
                {entry.moduleLabel}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm leading-snug">{entry.summary}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatHistorialDate(entry.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.userName}
              </span>
            </div>
          </div>
          {hasDetails && (
            <span className="text-muted-foreground shrink-0 mt-1">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          )}
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 pt-0 grid sm:grid-cols-2 gap-3 border-t border-dashed mx-4 mb-4 mt-0 pt-3">
          {entry.previousData && (
            <SnapshotBlock title="Datos anteriores" data={entry.previousData} tone="muted" />
          )}
          {entry.newData && (
            <SnapshotBlock title="Datos nuevos" data={entry.newData} tone="primary" />
          )}
        </div>
      )}
    </li>
  );
}

const FIELD_LABELS: Record<string, string> = {
  arete: "Arete",
  raza: "Raza",
  sexo: "Sexo",
  estado: "Estado",
  corral: "Corral",
  codigo: "Código",
  nombre: "Nombre",
  capacidad: "Capacidad",
  tipo: "Tipo",
  ocupacion: "Ocupación",
  concepto: "Concepto",
  monto: "Monto",
  fecha: "Fecha",
  categoria: "Categoría",
  comprador: "Comprador",
  pesoKg: "Peso",
  precioKg: "Precio/kg",
  total: "Total",
  folio: "Folio",
  costoUnitario: "Costo unitario",
  unidad: "Unidad",
  pesoInicialKg: "Peso inicial",
  pesoActualKg: "Peso actual",
  fechaIngreso: "Fecha ingreso",
  observaciones: "Observaciones",
  precioCompraKg: "Precio compra/kg",
  costoTotalCompra: "Costo total compra",
  tipoAdquisicion: "Origen adquisición",
  justificacion: "Justificación",
  justificacionOriginal: "Justificación original",
  aprobadoPor: "Aprobado por",
  aprobadoPorEmail: "Correo del aprobador",
  rolAprobador: "Rol del aprobador",
  fechaAprobacion: "Fecha de aprobación",
  rechazadoPor: "Rechazado por",
  notas: "Notas",
  estadoSolicitud: "Estado de solicitud",
  solicitudId: "ID solicitud",
  email: "Correo",
  cargo: "Cargo / puesto",
  actaId: "ID acta",
  texto: "Texto",
  autorNombre: "Registrado por",
};

function formatSnapshotValue(value: unknown, key?: string): React.ReactNode {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (
      (key?.toLowerCase().includes("fecha") || key === "fechaAprobacion") &&
      /^\d{4}-\d{2}-\d{2}/.test(value)
    ) {
      return formatHistorialDate(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatSnapshotValue(item)).join(", ");
  }
  if (typeof value === "object") {
    return <NestedSnapshot data={value as Record<string, unknown>} />;
  }
  return String(value);
}

function NestedSnapshot({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return "—";

  return (
    <dl className="space-y-0.5 text-right">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span className="text-muted-foreground">{FIELD_LABELS[key] ?? key}: </span>
          <span className="font-medium">{formatSnapshotValue(value, key)}</span>
        </div>
      ))}
    </dl>
  );
}

function SnapshotBlock({
  title,
  data,
  tone,
}: {
  title: string;
  data: Record<string, unknown>;
  tone: "muted" | "primary";
}) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        tone === "primary" ? "bg-white/80 border-indigo-100" : "bg-muted/40"
      }`}
    >
      <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <dl className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2 items-start">
            <dt className="text-muted-foreground shrink-0">
              {FIELD_LABELS[key] ?? key}
            </dt>
            <dd className="font-medium text-right min-w-0">
              {formatSnapshotValue(value, key)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatHistorialDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
