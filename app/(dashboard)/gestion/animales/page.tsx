"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AnimalesInventory } from "@/components/animales/AnimalesInventory";

export default function GestionAnimalesPage() {
  return (
    <AnimalesInventory
      title="Gestión de animales"
      historialHref="/gestion/animales/historial"
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
