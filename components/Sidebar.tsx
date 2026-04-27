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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

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

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        !sidebarOpen && "justify-center px-2"
      )}>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sidebar-primary shrink-0">
          <Tractor className="h-5 w-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight text-white">SGGE</p>
            <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate">
              Gestión Ganadera
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!sidebarOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                !sidebarOpen && "justify-center px-2"
              )}
            >
              <item.icon className={cn("shrink-0", sidebarOpen ? "h-4 w-4" : "h-5 w-5")} />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-9 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          title={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
        >
          {sidebarOpen ? (
            <span className="flex items-center gap-2 text-xs">
              <ChevronLeft className="h-4 w-4" />
              Colapsar
            </span>
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
