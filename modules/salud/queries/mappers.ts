import type {
  HealthAlertRecord,
  Medicamento,
  TreatmentRecord,
} from "../types/salud.types";

export function mapMedicamento(row: Record<string, unknown>): Medicamento {
  return {
    id: row.id as string,
    code: (row.codigo as string) ?? "",
    name: (row.nombre as string) ?? "",
    type: (row.tipo as string) ?? "vacuna",
    unit: (row.unidad_medida as string) ?? "dosis",
    pricePerUnit: Number(row.costo_unitario ?? 0),
    active: row.activo !== false,
    periodoCarenciaDias: Number(row.periodo_carencia_dias ?? 0) || 0,
    manualUso: (row.manual_uso as string) ?? null,
  };
}

export function mapTreatment(row: Record<string, unknown>): TreatmentRecord {
  const med = row.medicamentos as
    | { nombre?: string; periodo_carencia_dias?: number }
    | null;
  const name =
    (row.nombre as string) ||
    med?.nombre ||
    "Tratamiento";
  const animalCount = Number(row.animal_count ?? 1) || 1;
  const totalCost = Number(row.costo_total ?? 0);
  const costPerAnimal =
    Number(row.costo_por_animal ?? 0) ||
    (animalCount > 0 ? totalCost / animalCount : totalCost);
  const fechaFinCarencia = (row.fecha_fin_carencia as string) ?? null;
  const listoTraslado =
    row.listo_traslado == null ? fechaFinCarencia == null : Boolean(row.listo_traslado);

  return {
    id: row.id as string,
    type: (row.tipo as string) || "tratamiento",
    name,
    date: row.fecha_inicio as string,
    animalId: (row.animal_id as string) ?? null,
    medicamentoId: (row.medicamento_id as string) ?? null,
    animalCount,
    costPerAnimal,
    totalCost,
    appliedBy: (row.aplicado_por as string) ?? "",
    notes: (row.observaciones as string) ?? "",
    nextDue: (row.proxima_aplicacion as string) ?? null,
    status: (row.estado as string) ?? "aplicado",
    origen: (row.origen as string) ?? "manual",
    fechaFinCarencia,
    listoTraslado,
    diasCarencia:
      med?.periodo_carencia_dias != null
        ? Number(med.periodo_carencia_dias)
        : null,
  };
}

export function mapAlert(row: Record<string, unknown>): HealthAlertRecord {
  return {
    id: row.id as string,
    animalId: (row.animal_id as string) ?? null,
    tagId: (row.tag_id as string) ?? null,
    type: (row.tipo as HealthAlertRecord["type"]) ?? "programado",
    message: (row.mensaje as string) ?? "",
    dueDate: row.fecha_vencimiento as string,
    priority: (row.prioridad as HealthAlertRecord["priority"]) ?? "media",
    status: (row.estado as HealthAlertRecord["status"]) ?? "activa",
    tratamientoId: (row.tratamiento_id as string) ?? null,
  };
}

export function snapshotTratamiento(t: TreatmentRecord): Record<string, unknown> {
  return {
    nombre: t.name,
    tipo: t.type,
    fecha: t.date,
    animal_count: t.animalCount,
    costo_total: t.totalCost,
    aplicado_por: t.appliedBy,
    proxima: t.nextDue,
    fecha_fin_carencia: t.fechaFinCarencia,
    listo_traslado: t.listoTraslado,
  };
}

export function snapshotAlerta(a: HealthAlertRecord): Record<string, unknown> {
  return {
    mensaje: a.message,
    tipo: a.type,
    prioridad: a.priority,
    vencimiento: a.dueDate,
    estado: a.status,
    tag_id: a.tagId,
  };
}
