"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HistorialSistema } from "@/components/animales/HistorialAnimales";

export default function GestionHistorialPage() {
  return (
    <HistorialSistema
      title="Historial del sistema"
      subtitle="Libro de actas transversal — todos los módulos"
      showBackLink={
        <Link
          href="/gestion"
          className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      }
    />
  );
}
