"use client";

import { ModulosManager } from "@/components/modulos/ModulosManager";

export default function GestionModulosPage() {
  return (
    <ModulosManager
      variant="table"
      showBackLink
      title="Gestión de Módulos"
    />
  );
}
