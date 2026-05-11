"use client";

import Link from "next/link";
import { useStore, type AppState } from "@/store/useStore";
import {
  Beef,
  Grid3X3,
  DollarSign,
  HeartPulse,
  ShoppingCart,
  Wheat,
  Settings2,
  ChevronRight,
  Database,
} from "lucide-react";

interface GestionSection {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  iconBg: string;
  countFn: (store: AppState) => number;
  badge?: string;
}

const sections: GestionSection[] = [
  {
    href: "/gestion/animales",
    icon: Beef,
    label: "Animales",
    description: "Registrar, editar y eliminar animales del inventario ganadero.",
    color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
    iconBg: "bg-emerald-100 text-emerald-700",
    countFn: (s) => s.animals.length,
  },
  {
    href: "/gestion/modulos",
    icon: Grid3X3,
    label: "Módulos",
    description: "Administrar los corrales y módulos de la finca.",
    color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50/50",
    iconBg: "bg-violet-100 text-violet-700",
    countFn: (s) => s.modules.length,
  },
  {
    href: "/gestion/costos",
    icon: DollarSign,
    label: "Costos",
    description: "Gestionar gastos: alimentación, mano de obra, transporte y más.",
    color: "border-orange-200 hover:border-orange-400 hover:bg-orange-50/50",
    iconBg: "bg-orange-100 text-orange-700",
    countFn: (s) => s.costs.length,
  },
  {
    href: "/gestion/salud",
    icon: HeartPulse,
    label: "Salud",
    description: "Controlar tratamientos veterinarios y alertas sanitarias.",
    color: "border-red-200 hover:border-red-400 hover:bg-red-50/50",
    iconBg: "bg-red-100 text-red-700",
    countFn: (s) => s.treatments.length + s.healthAlerts.length,
  },
  {
    href: "/gestion/ventas",
    icon: ShoppingCart,
    label: "Ventas",
    description: "Registrar y editar ventas de ganado, compradores y precios.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50",
    iconBg: "bg-blue-100 text-blue-700",
    countFn: (s) => s.sales.length,
  },
  {
    href: "/gestion/alimentacion",
    icon: Wheat,
    label: "Alimentación",
    description: "Gestionar catálogo de insumos: consumo diario, precio y porcentaje.",
    color: "border-lime-200 hover:border-lime-400 hover:bg-lime-50/50",
    iconBg: "bg-lime-100 text-lime-700",
    countFn: (s) => s.feedTypes.length,
  },
];

export default function GestionPage() {
  const store = useStore();

  const totalRecords =
    store.animals.length +
    store.modules.length +
    store.costs.length +
    store.treatments.length +
    store.healthAlerts.length +
    store.sales.length +
    store.feedTypes.length;

  return (
    <div className="space-y-8">
      {/* Header */}
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
          <span className="font-semibold text-foreground">{totalRecords}</span>
          <span>registros totales</span>
        </div>
      </div>

      {/* Intro banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm text-foreground/80 leading-relaxed">
          Desde este centro puedes <strong>agregar</strong>, <strong>editar</strong> y{" "}
          <strong>eliminar</strong> datos de cada sección del sistema. Los cambios se
          reflejan automáticamente en los dashboards y reportes. Selecciona la sección
          que deseas administrar.
        </p>
      </div>

      {/* Grid de secciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const count = section.countFn(store);

          return (
            <Link
              key={section.href}
              href={section.href}
              className={`group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all duration-200 ${section.color}`}
            >
              {/* Icon + count */}
              <div className="flex items-start justify-between">
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${section.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-bold tabular-nums text-foreground/70">
                  {count}
                </span>
              </div>

              {/* Label + description */}
              <div>
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {section.description}
                </p>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
                Administrar
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Nota informativa */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        Los datos se almacenan en memoria durante la sesión. Para persistencia real, conecta con Supabase desde los endpoints de <code className="bg-muted px-1 rounded">/api/*</code>.
      </p>
    </div>
  );
}
