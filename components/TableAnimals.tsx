"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAnimals } from "@/lib/api/animals-client";
import type { Animal } from "@/lib/types/domain";
import { formatModuleLabel } from "@/lib/modulos/constants";
import { Loader2 } from "lucide-react";

interface TableAnimalsProps {
  limit?: number;
  showAll?: boolean;
}

const statusConfig = {
  activo: { label: "Activo", variant: "success" as const },
  vendido: { label: "Vendido", variant: "info" as const },
  muerto: { label: "Muerto", variant: "destructive" as const },
  enfermo: { label: "Enfermo", variant: "warning" as const },
};

export default function TableAnimals({ limit = 8, showAll = false }: TableAnimalsProps) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnimals()
      .then(setAnimals)
      .catch(() => setAnimals([]))
      .finally(() => setLoading(false));
  }, []);

  const data = showAll ? animals : animals.slice(0, limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No hay animales registrados.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Arete</TableHead>
          <TableHead>Raza</TableHead>
          <TableHead>Peso</TableHead>
          <TableHead>Módulo</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((animal) => {
          const status = statusConfig[animal.status];
          return (
            <TableRow key={animal.id}>
              <TableCell className="font-mono text-xs font-semibold">{animal.tagId}</TableCell>
              <TableCell>{animal.breed}</TableCell>
              <TableCell>{animal.currentWeight} kg</TableCell>
              <TableCell>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-lg">
                  {formatModuleLabel(animal.moduleId, animal.moduleName)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
