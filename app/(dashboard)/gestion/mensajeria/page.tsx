"use client";

import Link from "next/link";
import { ChevronLeft, Loader2, ShieldAlert } from "lucide-react";
import { MensajeriaGerente } from "@/components/mensajeria/MensajeriaGerente";
import { useSessionCapabilities } from "@/lib/hooks/useSessionCapabilities";

export default function GestionMensajeriaPage() {
  const { loading, capabilities } = useSessionCapabilities();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando permisos…
      </div>
    );
  }

  if (!capabilities.canApprove) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="text-xl font-semibold">Solo administradores</h1>
        <p className="text-sm text-muted-foreground">
          La autorización de modificaciones y acciones sensibles corresponde al
          rol administrador. Gerencia puede solicitar bajas; no aprobarlas.
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
    <MensajeriaGerente
      title="Autorizaciones — Administrador"
      subtitle="Revise y autorice o rechace solicitudes sensibles del sistema."
      showBackLink={
        <Link
          href="/gestion"
          className="flex items-center justify-center w-9 h-9 rounded-xl border hover:bg-muted transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      }
    />
  );
}
