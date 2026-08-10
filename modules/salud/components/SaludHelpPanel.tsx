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
              En Gestión de Salud → Nuevo tratamiento. Elige el destino:
              <strong> Hato</strong> (cantidad), <strong>Módulo</strong> (todos
              los animales del corral) o <strong>Animales</strong> (aretes
              concretos). También puedes aplicar desde la ficha de un animal.
              Si defines “próxima aplicación”, se crea una alerta automática.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-foreground mb-1">
              Carencia y traslado a subasta
            </h3>
            <p>
              En el catálogo de medicamentos registra los días de carencia del
              manual de uso. Al aplicar un tratamiento se calcula la fecha de
              fin de carencia (aplicación + días). Mientras esté en carencia el
              animal no debe trasladarse; al vencer, se marca “Listo traslado” y
              se notifica a los usuarios de la granja (campana del navbar).
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
              <li>anabólico · estimulante · vitamina · antibiótico</li>
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
