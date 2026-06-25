"use client";

import Link from "next/link";
import { ChevronLeft, Beef } from "lucide-react";
import { HistorialSistema } from "@/components/animales/HistorialAnimales";

export default function AnimalsHistorialPage() {
  return (
    <HistorialSistema
      defaultModulo="animales"
      showBackLink={
        <Link
          href="/animals"
          className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      }
      headerExtra={
        <Link
          href="/animals"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm hover:bg-muted transition-colors"
        >
          <Beef className="h-3.5 w-3.5" />
          Inventario
        </Link>
      }
    />
  );
}
