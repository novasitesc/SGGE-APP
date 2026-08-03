"use client";

import Link from "next/link";
import { SYSTEM_LOCALE } from "@/lib/utils";
import {
  Bell,
  Calendar,
  User,
  ChevronDown,
  LogOut,
  Search,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePendingSolicitudesCount } from "@/components/mensajeria/MensajeriaGerente";
import { fetchGranjaInfo } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { logoutAction } from "@/lib/auth/actions";

export default function Navbar() {
  const today = new Date().toLocaleDateString(SYSTEM_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { count: pendingCount } = usePendingSolicitudesCount();
  const { data: granja } = useApiQuery(fetchGranjaInfo);

  useEffect(() => {
    if (!showProfile) return;
    const onPointerDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showProfile]);

  const notifications =
    pendingCount > 0
      ? [
          {
            id: "pending-approvals",
            text: `${pendingCount} solicitud${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""} de aprobación del gerente`,
            time: "Requiere acción",
            href: "/gestion/mensajeria",
          },
        ]
      : [];

  const alertCount = notifications.length;

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar animal, módulo..."
          className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-64"
        />
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{today}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowNotif(!showNotif);
              setShowProfile(false);
            }}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl border bg-muted/50 hover:bg-muted transition-colors"
          >
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {alertCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold">Notificaciones</p>
                <p className="text-xs text-muted-foreground">
                  {alertCount > 0 ? `${alertCount} alertas activas` : "Sin notificaciones pendientes"}
                </p>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No hay notificaciones nuevas.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="hover:bg-muted/50 transition-colors">
                      <Link href={n.href} className="block px-4 py-3" onClick={() => setShowNotif(false)}>
                        <p className="text-sm leading-snug">{n.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                      </Link>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t text-center">
                <Link
                  href="/gestion/mensajeria"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={() => setShowNotif(false)}
                >
                  Ir a mensajería del gerente
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotif(false);
            }}
            className="flex items-center gap-2.5 rounded-xl border px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-tight">Usuario</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {granja?.name ?? "Cargando…"}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-56 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold">Cuenta</p>
                <p className="text-xs text-muted-foreground truncate">
                  {granja?.name ?? "Granja"}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/administracion"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Administración
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
