"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAnimals } from "@/lib/api/animals-client";
import {
  fetchCosts,
  fetchFeeding,
  fetchHealthAlerts,
  fetchModules,
  fetchSales,
  fetchTreatments,
} from "@/lib/api/data-client";
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
  MessageSquare,
} from "lucide-react";
import { usePendingSolicitudesCount } from "@/components/mensajeria/MensajeriaGerente";

interface SectionCounts {
  animals: number;
  modules: number;
  costs: number;
  treatments: number;
  healthAlerts: number;
  sales: number;
  feedTypes: number;
}

const sections = [
  {
    href: "/gestion/animales",
    icon: Beef,
    label: "Animales",
    description: "Registrar, editar y eliminar animales del inventario ganadero.",
    color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
    iconBg: "bg-emerald-100 text-emerald-700",
    countKey: "animals" as const,
  },
  {
    href: "/gestion/historial",
    icon: ScrollText,
    label: "Historial del sistema",
    description: "Libro de actas transversal: animales, ventas, costos, módulos y más.",
    color: "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50",
    iconBg: "bg-indigo-100 text-indigo-700",
    countKey: null,
    badge: "Auditoría",
  },
  {
    href: "/gestion/animales/historial",
    icon: ScrollText,
    label: "Historial animal",
    description: "Libro de actas del inventario: altas, cambios, bajas y ventas.",
    color: "border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50/30",
    iconBg: "bg-indigo-50 text-indigo-600",
    countKey: null,
  },
  {
    href: "/gestion/mensajeria",
    icon: MessageSquare,
    label: "Mensajería",
    description: "Bandeja del gerente: aprobar o rechazar solicitudes de baja y otras acciones.",
    color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50",
    iconBg: "bg-amber-100 text-amber-800",
    countKey: null,
    badge: "Gerente",
  },
  {
    href: "/gestion/modulos",
    icon: Grid3X3,
    label: "Módulos",
    description: "Administrar los corrales y módulos de la finca.",
    color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50/50",
    iconBg: "bg-violet-100 text-violet-700",
    countKey: "modules" as const,
  },
  {
    href: "/gestion/costos",
    icon: DollarSign,
    label: "Costos",
    description: "Gestionar gastos: alimentación, mano de obra, transporte y más.",
    color: "border-orange-200 hover:border-orange-400 hover:bg-orange-50/50",
    iconBg: "bg-orange-100 text-orange-700",
    countKey: "costs" as const,
  },
  {
    href: "/gestion/salud",
    icon: HeartPulse,
    label: "Salud",
    description: "Controlar tratamientos veterinarios y alertas sanitarias.",
    color: "border-red-200 hover:border-red-400 hover:bg-red-50/50",
    iconBg: "bg-red-100 text-red-700",
    countKey: "health" as const,
  },
  {
    href: "/gestion/ventas",
    icon: ShoppingCart,
    label: "Ventas",
    description: "Registrar y editar ventas de ganado, compradores y precios.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50",
    iconBg: "bg-blue-100 text-blue-700",
    countKey: "sales" as const,
  },
  {
    href: "/gestion/alimentacion",
    icon: Wheat,
    label: "Alimentación",
    description: "Gestionar catálogo de insumos: consumo diario, precio y porcentaje.",
    color: "border-lime-200 hover:border-lime-400 hover:bg-lime-50/50",
    iconBg: "bg-lime-100 text-lime-700",
    countKey: "feedTypes" as const,
  },
];

export default function GestionPage() {
  const { count: pendingMensajes } = usePendingSolicitudesCount();
  const [counts, setCounts] = useState<SectionCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [animals, modules, costs, treatments, healthAlerts, sales, feeding] =
          await Promise.all([
            fetchAnimals(),
            fetchModules(),
            fetchCosts(),
            fetchTreatments(),
            fetchHealthAlerts(),
            fetchSales(),
            fetchFeeding(),
          ]);
        if (!cancelled) {
          setCounts({
            animals: animals.length,
            modules: modules.length,
            costs: costs.length,
            treatments: treatments.length,
            healthAlerts: healthAlerts.length,
            sales: sales.length,
            feedTypes: feeding.feedTypes.length,
          });
        }
      } catch {
        if (!cancelled) {
          setCounts({
            animals: 0,
            modules: 0,
            costs: 0,
            treatments: 0,
            healthAlerts: 0,
            sales: 0,
            feedTypes: 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRecords = counts
    ? counts.animals +
      counts.modules +
      counts.costs +
      counts.treatments +
      counts.healthAlerts +
      counts.sales +
      counts.feedTypes
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{counts ? totalRecords : "…"}</span>
          <span>registros totales</span>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm text-foreground/80 leading-relaxed">
          Desde este centro puedes <strong>agregar</strong>, <strong>editar</strong> y{" "}
          <strong>eliminar</strong> datos de cada sección del sistema. Los cambios se
          reflejan automáticamente en los dashboards y reportes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          let count = 0;
          if (section.href === "/gestion/mensajeria") {
            count = pendingMensajes;
          } else if (section.countKey && counts) {
            if (section.countKey === "health") {
              count = counts.treatments + counts.healthAlerts;
            } else {
              count = counts[section.countKey];
            }
          }

          return (
            <Link
              key={section.href}
              href={section.href}
              className={`group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all duration-200 ${section.color}`}
            >
              <div className="flex items-start justify-between">
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${section.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-bold tabular-nums text-foreground/70">
                  {counts || section.href === "/gestion/mensajeria" ? count : "…"}
                </span>
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
        })}
      </div>
    </div>
  );
}
