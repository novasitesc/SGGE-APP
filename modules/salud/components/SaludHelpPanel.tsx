"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SaludHelpPanel({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            Manual de datos sanitarios
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h3 className="font-semibold text-foreground mb-1">Inscripción manual</h3>
            <p>
              En Gestión de Salud → Nuevo tratamiento. Indica medicamento, tipo,
              fecha, animales y costos. Si defines “próxima aplicación”, el
              sistema crea una alerta automática.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">Importar PDF</h3>
            <p>
              Sube una receta o factura veterinaria. El texto se extrae y se
              muestra en un formulario de revisión: corrige campos y confirma
              para inscribir el tratamiento.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">Plantilla CSV</h3>
            <p>
              Descarga la plantilla desde Gestión → Cargas, completa filas y usa
              el flujo de importación o carga manual línea a línea. Columnas:
              nombre, tipo, fecha, animales, costo_por_animal, aplicado_por,
              proxima, notas.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">Tipos</h3>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>vacuna · desparasitante · implante</li>
              <li>anabólico · vitamina · antibiótico</li>
            </ul>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">Trazabilidad</h3>
            <p>
              Cada alta, edición, baja, importación y exportación queda en
              Historial del sistema (módulo Salud).
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">Exportar informe</h3>
            <p>
              Desde /health puedes abrir el informe HTML (imprimir → PDF) o
              descargar CSV del período filtrado.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
