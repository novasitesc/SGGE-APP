"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Beef,
  Grid3X3,
  Wheat,
  DollarSign,
  HeartPulse,
  ShoppingCart,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Tractor,
  Settings2,
  MessageSquare,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { useSessionCapabilities } from "@/lib/hooks/useSessionCapabilities";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Animales", href: "/animals", icon: Beef },
  { label: "Módulos", href: "/modules", icon: Grid3X3 },
  { label: "Alimentación", href: "/feeding", icon: Wheat },
  { label: "Costos", href: "/costs", icon: DollarSign },
  { label: "Salud", href: "/health", icon: HeartPulse },
  { label: "Ventas", href: "/sales", icon: ShoppingCart },
  { label: "Reportes", href: "/reports", icon: BarChart3 },
];

/** Gerencia: operación diaria de datos. */
const gerenciaItems = [
  { label: "Gestión de Datos", href: "/gestion", icon: Settings2 },
];

/** Admin: catálogos y autorizaciones. */
const adminItems = [
  { label: "Administración", href: "/administracion", icon: Tags },
  { label: "Autorizaciones", href: "/gestion/mensajeria", icon: MessageSquare },
];

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

function isActivePath(pathname: string, href: string, opts?: { exclude?: string }) {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  if (opts?.exclude && pathname.startsWith(opts.exclude)) return false;
  return true;
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-white"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span
        className={cn(
          "truncate whitespace-nowrap transition-opacity duration-200",
          collapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function SectionDivider({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <div className="px-3 pt-3 pb-1">
      <div
        className={cn(
          "border-t border-sidebar-border transition-all duration-300",
          collapsed && "mx-auto w-6"
        )}
      />
      <p
        className={cn(
          "mt-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 whitespace-nowrap transition-opacity duration-200",
          collapsed ? "h-0 mt-0 opacity-0 overflow-hidden" : "opacity-100"
        )}
      >
        {label}
      </p>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useStore();
  const collapsed = !sidebarOpen;
  const { loading, capabilities } = useSessionCapabilities();
  const showAdmin = !loading && capabilities.isAdmin;

  return (
    <aside
      className={cn(
        "relative h-screen shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Ancho fijo interno: el aside solo recorta, el layout no se reestructura. */}
      <div className="flex h-full w-64 flex-col">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary">
            <Tractor className="h-5 w-5 text-white" />
          </div>
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-opacity duration-200",
              collapsed ? "opacity-0" : "opacity-100"
            )}
          >
            <p className="truncate text-sm font-bold leading-tight text-white">
              SGGE
            </p>
            <p className="truncate text-[10px] leading-tight text-sidebar-foreground/60">
              Gestión Ganadera
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}

          <SectionDivider label="Gerencia" collapsed={collapsed} />
          {gerenciaItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActivePath(pathname, item.href, {
                exclude: "/gestion/mensajeria",
              })}
              collapsed={collapsed}
            />
          ))}

          {showAdmin && (
            <>
              <SectionDivider label="Administración" collapsed={collapsed} />
              {adminItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  collapsed={collapsed}
                />
              ))}
            </>
          )}
        </nav>

        {/* Toggle */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-expanded={sidebarOpen}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronLeft className="h-4 w-4 shrink-0" />
            )}
            <span
              className={cn(
                "text-xs whitespace-nowrap transition-opacity duration-200",
                collapsed ? "opacity-0" : "opacity-100"
              )}
            >
              Colapsar
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
