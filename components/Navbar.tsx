"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SYSTEM_LOCALE } from "@/lib/utils";
import {
  Bell,
  Calendar,
  User,
  ChevronDown,
  LogOut,
  Search,
  Settings2,
  Beef,
  Warehouse,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePendingSolicitudesCount } from "@/components/mensajeria/MensajeriaGerente";
import { useSessionCapabilities } from "@/lib/hooks/useSessionCapabilities";
import {
  fetchGranjaInfo,
  fetchNotificacionesApi,
  markNotificacionLeidaApi,
  type NotificacionInboxItem,
} from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { logoutAction } from "@/lib/auth/actions";
import { parseJson } from "@/lib/api/parse-json";

type SearchHit = {
  type: "animal" | "modulo";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export default function Navbar() {
  const router = useRouter();
  const today = new Date().toLocaleDateString(SYSTEM_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const { count: pendingCount } = usePendingSolicitudesCount();
  const { usuario, capabilities } = useSessionCapabilities();
  const canApprove = capabilities.canApprove;
  const { data: granja } = useApiQuery("granja", fetchGranjaInfo);
  const [saludNotifs, setSaludNotifs] = useState<NotificacionInboxItem[]>([]);
  const [saludUnread, setSaludUnread] = useState(0);

  const loadSaludNotifs = useCallback(async () => {
    try {
      const data = await fetchNotificacionesApi(true);
      setSaludNotifs(data.items);
      setSaludUnread(data.unreadCount);
    } catch {
      setSaludNotifs([]);
      setSaludUnread(0);
    }
  }, []);

  useEffect(() => {
    void loadSaludNotifs();
    const t = window.setInterval(() => {
      void loadSaludNotifs();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [loadSaludNotifs]);

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

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(q)}`,
            { cache: "no-store" }
          );
          const data = await parseJson<{ items: SearchHit[] }>(res);
          setHits(data.items);
          setSearchOpen(true);
        } catch {
          setHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const goToHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false);
      setQuery("");
      setHits([]);
      router.push(hit.href);
    },
    [router]
  );

  const approvalNotifications =
    canApprove && pendingCount > 0
      ? [
          {
            id: "pending-approvals",
            text: `${pendingCount} solicitud${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""} de autorización`,
            time: "Requiere acción del administrador",
            href: "/gestion/mensajeria",
            kind: "approval" as const,
          },
        ]
      : [];

  const saludNotifications = saludNotifs.map((n) => ({
    id: n.id,
    text: n.titulo,
    time: n.mensaje,
    href: "/gestion/salud",
    kind: "salud" as const,
  }));

  const notifications = [...approvalNotifications, ...saludNotifications];
  const alertCount = (canApprove ? pendingCount : 0) + saludUnread;

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="relative hidden md:block" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (hits.length > 0 || query.trim()) setSearchOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter" && hits[0]) {
              e.preventDefault();
              goToHit(hits[0]);
            }
          }}
          placeholder="Buscar animal, módulo..."
          className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-64"
          aria-label="Búsqueda global"
          aria-expanded={searchOpen}
          aria-controls="navbar-search-results"
        />
        {searchOpen && query.trim().length > 0 && (
          <div
            id="navbar-search-results"
            className="absolute left-0 top-11 w-80 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden"
            role="listbox"
          >
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Resultados
              </p>
              {searching && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y">
              {!searching && hits.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  Sin coincidencias para “{query.trim()}”.
                </p>
              ) : (
                hits.map((hit) => {
                  const Icon = hit.type === "animal" ? Beef : Warehouse;
                  return (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      type="button"
                      role="option"
                      onClick={() => goToHit(hit)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {hit.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {hit.type === "animal" ? "Animal" : "Módulo"} ·{" "}
                          {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
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
                  {alertCount > 0
                    ? `${alertCount} alertas activas`
                    : "Sin notificaciones pendientes"}
                </p>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No hay notificaciones nuevas.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <Link
                        href={n.href}
                        className="block px-4 py-3"
                        onClick={() => {
                          setShowNotif(false);
                          if (n.kind === "salud") {
                            void markNotificacionLeidaApi(n.id).then(() =>
                              loadSaludNotifs()
                            );
                          }
                        }}
                      >
                        <p className="text-sm leading-snug">{n.text}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.time}
                        </p>
                      </Link>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t flex items-center justify-center gap-3">
                <Link
                  href="/gestion/salud"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={() => setShowNotif(false)}
                >
                  Ver salud
                </Link>
                {canApprove && (
                  <Link
                    href="/gestion/mensajeria"
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setShowNotif(false)}
                  >
                    Autorizaciones
                  </Link>
                )}
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
              <p className="text-xs font-semibold leading-tight">
                {usuario
                  ? [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") ||
                    usuario.email
                  : "Usuario"}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {capabilities.isAdmin
                  ? "Administrador"
                  : capabilities.isGerencia
                    ? "Gerencia"
                    : (granja?.name ?? "Cargando…")}
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
                {capabilities.isAdmin && (
                  <Link
                    href="/administracion"
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  >
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Administración
                  </Link>
                )}
                <Link
                  href="/gestion"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Beef className="h-4 w-4 text-muted-foreground" />
                  Gestión de datos
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
