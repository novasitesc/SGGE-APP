"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Menu,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_GROUPS,
  DEFAULT_ADMIN_SECTION,
  findAdminSection,
  isAdminSectionId,
  type AdminSectionId,
} from "@/components/administracion/nav";
import { RazasAdminPanel } from "@/components/administracion/RazasAdminPanel";

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
        Esta opción estará disponible pronto. El menú ya está preparado para
        incorporar más catálogos de administración.
      </p>
    </div>
  );
}

function SectionContent({ sectionId }: { sectionId: AdminSectionId }) {
  switch (sectionId) {
    case "razas":
      return <RazasAdminPanel />;
    case "categorias":
      return <ComingSoon label="Categorías de animales" />;
    case "estados":
      return <ComingSoon label="Estados de animal" />;
    case "corrales":
      return <ComingSoon label="Tipos de corral" />;
    case "lotes":
      return <ComingSoon label="Lotes" />;
    default:
      return <RazasAdminPanel />;
  }
}

export function AdministracionShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("seccion");
  const active = findAdminSection(
    sectionParam && isAdminSectionId(sectionParam)
      ? sectionParam
      : DEFAULT_ADMIN_SECTION
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.id, true]))
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV_GROUPS;
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const selectSection = (id: AdminSectionId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("seccion", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setMenuOpen(false);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const menuBody = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Menú administración</p>
          <p className="text-[11px] text-muted-foreground">
            Catálogos y configuración
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar opción…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredGroups.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            Sin coincidencias para “{query}”.
          </p>
        ) : (
          filteredGroups.map((group) => {
            const open = query.trim() ? true : expandedGroups[group.id] !== false;
            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>
                {open &&
                  group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!item.available}
                        onClick={() => item.available && selectSection(item.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : item.available
                              ? "hover:bg-muted"
                              : "opacity-55 cursor-not-allowed"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            isActive ? "text-primary-foreground" : "text-muted-foreground"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {item.label}
                            </span>
                            {!item.available && (
                              <span
                                className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                                  isActive
                                    ? "bg-primary-foreground/20"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                Pronto
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "block text-[11px] leading-snug mt-0.5 line-clamp-2",
                              isActive
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );

  return (
    <div className="relative space-y-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 transition-colors",
            menuOpen
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card hover:bg-muted"
          )}
          aria-expanded={menuOpen}
          aria-controls="admin-menu-panel"
          aria-label="Abrir menú de administración"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                Administración
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {active.label} · {active.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay + panel hamburguesa */}
      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="admin-menu-panel"
            className={cn(
              "fixed z-50 top-0 left-0 h-full w-[min(20rem,88vw)] bg-card border-r shadow-2xl",
              "animate-in slide-in-from-left duration-200",
              "md:absolute md:top-14 md:left-0 md:h-auto md:max-h-[min(32rem,70vh)] md:w-80 md:rounded-2xl md:border md:shadow-xl"
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de opciones de administración"
          >
            {menuBody}
          </aside>
        </>
      )}

      <div className="min-w-0">
        <SectionContent sectionId={active.id} />
      </div>
    </div>
  );
}
