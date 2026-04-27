"use client";

import { Bell, Calendar, User, ChevronDown, Search } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [showNotif, setShowNotif] = useState(false);

  const notifications = [
    { id: 1, text: "BV-006 requiere atención veterinaria urgente", time: "Hace 30 min", type: "urgente" },
    { id: 2, text: "Implante Revalor-G vence en 14 días", time: "Hace 2 h", type: "programado" },
    { id: 3, text: "Pesaje mensual programado para mañana", time: "Hace 4 h", type: "revisión" },
  ];

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar animal, módulo..."
          className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-64"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Date */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{today}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl border bg-muted/50 hover:bg-muted transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {notifications.length}
            </span>
          </button>

          {showNotif && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold">Notificaciones</p>
                <p className="text-xs text-muted-foreground">{notifications.length} alertas activas</p>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                    <p className="text-sm leading-snug">{n.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t text-center">
                <button className="text-xs text-primary hover:underline font-medium">
                  Ver todas las alertas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <button className="flex items-center gap-2.5 rounded-xl border px-3 py-1.5 hover:bg-muted transition-colors">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-tight">Admin</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Rancho El Encino</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
