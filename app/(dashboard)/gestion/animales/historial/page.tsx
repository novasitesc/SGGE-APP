"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HistorialSistema } from "@/components/animales/HistorialAnimales";

export default function GestionHistorialAnimalesPage() {
  return (
    <HistorialSistema
      title="Historial animal"
      subtitle="Libro de actas — trazabilidad del inventario"
      defaultModulo="animales"
      showBackLink={
        <Link
          href="/gestion/animales"
          className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      }
    />
  );
}
