"use client";

import { Suspense } from "react";
import Link from "next/link";
import { AdministracionShell } from "@/components/administracion/AdministracionShell";
import { useSessionCapabilities } from "@/lib/hooks/useSessionCapabilities";
import { ChevronLeft, Loader2, ShieldAlert } from "lucide-react";

function AdminFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando administración…
    </div>
  );
}

function AdminGate() {
  const { loading, capabilities } = useSessionCapabilities();

  if (loading) return <AdminFallback />;

  if (!capabilities.canManageCatalogs) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="text-xl font-semibold">Solo administradores</h1>
        <p className="text-sm text-muted-foreground">
          Los catálogos del sistema (razas, categorías, estados, lotes y tipos
          de corral) solo los puede modificar el administrador.
        </p>
        <Link
          href="/gestion"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a gestión
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<AdminFallback />}>
      <AdministracionShell />
    </Suspense>
  );
}

export default function AdministracionPage() {
  return <AdminGate />;
}
