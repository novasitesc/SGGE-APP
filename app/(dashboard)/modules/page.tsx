"use client";

import { ModulosManager } from "@/components/modulos/ModulosManager";
import { useAnimals } from "@/lib/hooks/useAnimals";

export default function ModulesPage() {
  const { animals } = useAnimals();

  return <ModulosManager variant="cards" animals={animals} title="Módulos" />;
}
