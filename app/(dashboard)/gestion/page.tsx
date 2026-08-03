"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAnimals } from "@/lib/api/animals-client";
import {
  fetchCosts,
  fetchFeeding,
  fetchHealthAlerts,
  fetchModules,
  fetchRazas,
  fetchSales,
  fetchTreatments,
} from "@/lib/api/data-client";
import { fetchHistorial } from "@/lib/api/historial-client";
import { fetchPendingSolicitudesCount } from "@/lib/api/solicitudes-client";
import { fetchComprobantes } from "@/lib/api/comprobantes-client";
import {
  Beef,
  Grid3X3,
  DollarSign,
  HeartPulse,
  ShoppingCart,
  Wheat,
  Settings2,
  ChevronRight,
  ScrollText,
  Database,
  FileText,
  MessageSquare,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { usePendingSolicitudesCount } from "@/components/mensajeria/MensajeriaGerente";

interface SectionCounts {
  animals: number;
  razas: number;
  historialSistema: number;
  historialAnimales: number;
  modules: number;
  costs: number;
  treatments: number;
  healthAlerts: number;
  sales: number;
  feedTypes: number;
  comprobantes: number;
  mensajeria: number;
}

type CountKey = keyof SectionCounts | "health";

type SortMode = "grupos" | "az" | "za" | "mayor" | "menor";

type GestionSection = {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  iconBg: string;
  countKey: CountKey;
  group: string;
  badge?: string;
};

const sections: GestionSection[] = [
  {
    href: "/gestion/animales",
    icon: Beef,
    label: "Animales",
    description: "Registrar, editar y eliminar animales del inventario ganadero.",
    color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
    iconBg: "bg-emerald-100 text-emerald-700",
    countKey: "animals",
    group: "Animales",
  },
  {
    href: "/administracion",
    icon: Beef,
    label: "Razas (Administración)",
    description: "Agregar razas y modificar nombres del catálogo ganadero.",
    color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50/50",
    iconBg: "bg-teal-100 text-teal-700",
    countKey: "razas",
    group: "Animales",
  },
  {
    href: "/gestion/historial",
    icon: ScrollText,
    label: "Historial del sistema",
    description: "Libro de actas transversal: animales, ventas, costos, módulos y más.",
    color: "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50",
    iconBg: "bg-indigo-100 text-indigo-700",
    countKey: "historialSistema",
    group: "Historial",
    badge: "Auditoría",
  },
  {
    href: "/gestion/animales/historial",
    icon: ScrollText,
    label: "Historial animal",
    description: "Libro de actas del inventario: altas, cambios, bajas y ventas.",
    color: "border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50/30",
    iconBg: "bg-indigo-50 text-indigo-600",
    countKey: "historialAnimales",
    group: "Historial",
  },
  {
    href: "/gestion/modulos",
    icon: Grid3X3,
    label: "Módulos",
    description: "Administrar los corrales y módulos de la finca.",
    color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50/50",
    iconBg: "bg-violet-100 text-violet-700",
    countKey: "modules",
    group: "Módulos",
  },
  {
    href: "/gestion/salud",
    icon: HeartPulse,
    label: "Salud",
    description: "Controlar tratamientos veterinarios y alertas sanitarias.",
    color: "border-red-200 hover:border-red-400 hover:bg-red-50/50",
    iconBg: "bg-red-100 text-red-700",
    countKey: "health",
    group: "Operación",
  },
  {
    href: "/gestion/alimentacion",
    icon: Wheat,
    label: "Alimentación",
    description:
      "Productos del catálogo, compras PDF por insumo, precios y totales.",
    color: "border-lime-200 hover:border-lime-400 hover:bg-lime-50/50",
    iconBg: "bg-lime-100 text-lime-700",
    countKey: "feedTypes",
    group: "Operación",
  },
  {
    href: "/gestion/costos",
    icon: DollarSign,
    label: "Costos",
    description:
      "Gastos operativos y procedentes de facturas confirmadas (categoría, emisor y origen).",
    color: "border-orange-200 hover:border-orange-400 hover:bg-orange-50/50",
    iconBg: "bg-orange-100 text-orange-700",
    countKey: "costs",
    group: "Finanzas",
  },
  {
    href: "/gestion/ventas",
    icon: ShoppingCart,
    label: "Ventas",
    description: "Registrar y editar ventas de ganado, compradores y precios.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50",
    iconBg: "bg-blue-100 text-blue-700",
    countKey: "sales",
    group: "Finanzas",
  },
  {
    href: "/gestion/comprobantes",
    icon: FileText,
    label: "Comprobantes",
    description:
      "Sube facturas PDF y confírmalas: alimentan Costos (gastos) o Animales (compras).",
    color: "border-sky-200 hover:border-sky-400 hover:bg-sky-50/50",
    iconBg: "bg-sky-100 text-sky-700",
    countKey: "comprobantes",
    group: "Finanzas",
    badge: "Nuevo",
  },
  {
    href: "/gestion/mensajeria",
    icon: MessageSquare,
    label: "Mensajería",
    description: "Bandeja del gerente: aprobar o rechazar solicitudes de baja y otras acciones.",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50",
    iconBg: "bg-amber-100 text-amber-800",
    countKey: "mensajeria",
    group: "Administración",
    badge: "Gerente",
  },
];

const GROUP_ORDER = [
  "Animales",
  "Historial",
  "Módulos",
  "Operación",
  "Finanzas",
  "Administración",
] as const;

const SORT_OPTIONS: {
  value: SortMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "grupos", label: "Por grupos", icon: LayoutGrid },
  { value: "az", label: "A → Z", icon: ArrowDownAZ },
  { value: "za", label: "Z → A", icon: ArrowUpAZ },
  { value: "mayor", label: "Mayor → menor", icon: ArrowDownWideNarrow },
  { value: "menor", label: "Menor → mayor", icon: ArrowUpWideNarrow },
];

function resolveCount(
  section: GestionSection,
  counts: SectionCounts | null
): number {
  if (!counts) return 0;
  if (section.countKey === "health") {
    return counts.treatments + counts.healthAlerts;
  }
  return counts[section.countKey];
}

function SectionCard({
  section,
  count,
  countsReady,
}: {
  section: GestionSection;
  count: number;
  countsReady: boolean;
}) {
  const Icon = section.icon;

  return (
    <Link
      href={section.href}
      className={`group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all duration-200 ${section.color}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${section.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col items-end gap-1">
          {section.badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {section.badge}
            </span>
          )}
          <span className="text-3xl font-bold tabular-nums text-foreground/70">
            {countsReady ? count : "…"}
          </span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
          {section.label}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {section.description}
        </p>
      </div>

      <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
        Administrar
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function GestionPage() {
  const { refresh: refreshMensajes } = usePendingSolicitudesCount();
  const [counts, setCounts] = useState<SectionCounts | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("grupos");

  const syncCounts = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchAnimals(),
      fetchRazas(),
      fetchModules(),
      fetchCosts(),
      fetchTreatments(),
      fetchHealthAlerts(),
      fetchSales(),
      fetchFeeding(),
      fetchHistorial({ limit: 1 }),
      fetchHistorial({ modulo: "animales", limit: 1 }),
      fetchPendingSolicitudesCount(),
      fetchComprobantes(),
    ]);

    const value = <T,>(i: number, fallback: T): T => {
      const r = results[i];
      return r.status === "fulfilled" ? (r.value as T) : fallback;
    };

    const animals = value(0, [] as Awaited<ReturnType<typeof fetchAnimals>>);
    const razas = value(1, [] as string[]);
    const modules = value(2, [] as Awaited<ReturnType<typeof fetchModules>>);
    const costs = value(3, [] as Awaited<ReturnType<typeof fetchCosts>>);
    const treatments = value(4, [] as Awaited<ReturnType<typeof fetchTreatments>>);
    const healthAlerts = value(5, [] as Awaited<ReturnType<typeof fetchHealthAlerts>>);
    const sales = value(6, [] as Awaited<ReturnType<typeof fetchSales>>);
    const feeding = value(7, { feedTypes: [] } as unknown as Awaited<ReturnType<typeof fetchFeeding>>);
    const historialSistema = value(8, { total: 0 });
    const historialAnimales = value(9, { total: 0 });
    const mensajeria = value(10, 0);
    const comprobantes = value(11, [] as Awaited<ReturnType<typeof fetchComprobantes>>);

    setCounts({
      animals: animals.length,
      razas: razas.length,
      modules: modules.length,
      costs: costs.length,
      treatments: treatments.length,
      healthAlerts: healthAlerts.length,
      sales: sales.length,
      feedTypes: feeding.feedTypes.length,
      historialSistema: historialSistema.total,
      historialAnimales: historialAnimales.total,
      comprobantes: comprobantes.length,
      mensajeria,
    });
    void refreshMensajes();
  }, [refreshMensajes]);

  useEffect(() => {
    void syncCounts();

    const onFocus = () => void syncCounts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncCounts]);

  const totalRecords = counts
    ? counts.animals +
      counts.modules +
      counts.costs +
      counts.treatments +
      counts.healthAlerts +
      counts.sales +
      counts.feedTypes +
      counts.razas
    : 0;

  const sortedFlat = useMemo(() => {
    const withCount = sections.map((section) => ({
      section,
      count: resolveCount(section, counts),
    }));

    if (sortMode === "az") {
      return [...withCount].sort((a, b) =>
        a.section.label.localeCompare(b.section.label, "es")
      );
    }
    if (sortMode === "za") {
      return [...withCount].sort((a, b) =>
        b.section.label.localeCompare(a.section.label, "es")
      );
    }
    if (sortMode === "mayor") {
      return [...withCount].sort((a, b) => b.count - a.count);
    }
    if (sortMode === "menor") {
      return [...withCount].sort((a, b) => a.count - b.count);
    }
    return withCount;
  }, [counts, sortMode]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: sections
        .filter((s) => s.group === group)
        .map((section) => ({
          section,
          count: resolveCount(section, counts),
        })),
    })).filter((g) => g.items.length > 0);
  }, [counts]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Centro de Gestión</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Administra todos los datos del sistema desde un solo lugar
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2 self-start">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{counts ? totalRecords : "…"}</span>
          <span>registros totales</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {sortMode === "grupos"
            ? "Vista agrupada por tema (Animales, Historial, etc.)"
            : "Vista en lista ordenada"}
        </p>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSortMode(value)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                sortMode === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {sortMode === "grupos" ? (
        <div className="space-y-8">
          {grouped.map(({ group, items }) => (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(({ section, count }) => (
                  <SectionCard
                    key={section.href}
                    section={section}
                    count={count}
                    countsReady={counts !== null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFlat.map(({ section, count }) => (
            <SectionCard
              key={section.href}
              section={section}
              count={count}
              countsReady={counts !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
