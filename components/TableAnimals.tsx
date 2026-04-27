import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { animals } from "@/lib/mockData";
import { formatDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const statusConfig = {
  activo: { label: "Activo", variant: "success" as const },
  vendido: { label: "Vendido", variant: "info" as const },
  muerto: { label: "Muerto", variant: "destructive" as const },
  enfermo: { label: "Enfermo", variant: "warning" as const },
};

interface TableAnimalsProps {
  limit?: number;
  showAll?: boolean;
}

export default function TableAnimals({ limit = 8, showAll = false }: TableAnimalsProps) {
  const data = showAll ? animals : animals.slice(0, limit);

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead>Arete</TableHead>
          <TableHead>Raza</TableHead>
          <TableHead className="hidden md:table-cell">F. Entrada</TableHead>
          <TableHead className="hidden sm:table-cell">Peso Ini.</TableHead>
          <TableHead>Peso Act.</TableHead>
          <TableHead className="hidden lg:table-cell">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Ganancia
            </div>
          </TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((animal) => {
          const gain = animal.currentWeight - animal.initialWeight;
          const status = statusConfig[animal.status];
          return (
            <TableRow key={animal.id}>
              <TableCell className="font-mono font-semibold text-xs">{animal.tagId}</TableCell>
              <TableCell className="font-medium">{animal.breed}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                {formatDate(animal.entryDate)}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {animal.initialWeight} kg
              </TableCell>
              <TableCell className="font-semibold">{animal.currentWeight} kg</TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-emerald-600 font-medium">+{gain} kg</span>
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
