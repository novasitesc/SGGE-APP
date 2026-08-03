/**
 * Validación de payloads del módulo Salud.
 * (Zod no está disponible en el entorno; misma superficie de API.)
 */

import type {
  AlertPrioridad,
  AlertTipo,
  CreateAlertInput,
  CreateMedicamentoInput,
  CreateTreatmentInput,
  UpdateAlertInput,
  UpdateTreatmentInput,
} from "./salud.types";
import { TREATMENT_TYPES } from "./salud.types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ALERT_TIPOS: AlertTipo[] = [
  "tratamiento",
  "revisión",
  "urgente",
  "programado",
];
const ALERT_PRIORIDADES: AlertPrioridad[] = ["alta", "media", "baja"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseCreateTreatment(
  body: unknown
): ValidationResult<CreateTreatmentInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.name)) {
    return { ok: false, error: "name es obligatorio." };
  }
  if (!isNonEmptyString(b.date)) {
    return { ok: false, error: "date es obligatorio." };
  }
  const animalCount = asNumber(b.animalCount) ?? 1;
  if (animalCount < 1) {
    return { ok: false, error: "animalCount debe ser >= 1." };
  }
  const costPerAnimal = asNumber(b.costPerAnimal) ?? 0;
  if (costPerAnimal < 0) {
    return { ok: false, error: "costPerAnimal inválido." };
  }
  const totalCost =
    asNumber(b.totalCost) ?? Math.round(animalCount * costPerAnimal * 100) / 100;
  const type = isNonEmptyString(b.type) ? b.type : "vacuna";
  if (
    !TREATMENT_TYPES.includes(type as (typeof TREATMENT_TYPES)[number]) &&
    type !== "tratamiento"
  ) {
    // permite tipos custom / legado
  }

  const animalIds = Array.isArray(b.animalIds)
    ? (b.animalIds as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;

  return {
    ok: true,
    data: {
      type,
      name: b.name.trim(),
      date: b.date,
      animalCount,
      costPerAnimal,
      totalCost,
      appliedBy: typeof b.appliedBy === "string" ? b.appliedBy.trim() : "",
      notes: typeof b.notes === "string" ? b.notes.trim() : "",
      nextDue: typeof b.nextDue === "string" && b.nextDue ? b.nextDue : undefined,
      animalId: typeof b.animalId === "string" ? b.animalId : undefined,
      animalIds,
      medicamentoId:
        typeof b.medicamentoId === "string" ? b.medicamentoId : undefined,
      loteId: typeof b.loteId === "string" ? b.loteId : undefined,
    },
  };
}

export function parseUpdateTreatment(
  body: unknown
): ValidationResult<UpdateTreatmentInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const created = parseCreateTreatment({
    name: "x",
    date: "2000-01-01",
    animalCount: 1,
    costPerAnimal: 0,
    ...(body as object),
  });
  if (!created.ok) return created;
  const b = body as Record<string, unknown>;
  const data: UpdateTreatmentInput = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.type === "string") data.type = b.type;
  if (typeof b.date === "string") data.date = b.date;
  if (b.animalCount != null) data.animalCount = asNumber(b.animalCount) ?? undefined;
  if (b.costPerAnimal != null)
    data.costPerAnimal = asNumber(b.costPerAnimal) ?? undefined;
  if (b.totalCost != null) data.totalCost = asNumber(b.totalCost) ?? undefined;
  if (typeof b.appliedBy === "string") data.appliedBy = b.appliedBy.trim();
  if (typeof b.notes === "string") data.notes = b.notes.trim();
  if (typeof b.nextDue === "string") data.nextDue = b.nextDue || undefined;
  if (typeof b.status === "string") data.status = b.status;
  if (typeof b.animalId === "string") data.animalId = b.animalId;
  if (typeof b.medicamentoId === "string") data.medicamentoId = b.medicamentoId;
  if (Array.isArray(b.animalIds)) {
    data.animalIds = (b.animalIds as unknown[]).filter(
      (x): x is string => typeof x === "string"
    );
  }
  return { ok: true, data };
}

export function parseCreateAlert(
  body: unknown
): ValidationResult<CreateAlertInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.message)) {
    return { ok: false, error: "message es obligatorio." };
  }
  if (!isNonEmptyString(b.dueDate)) {
    return { ok: false, error: "dueDate es obligatorio." };
  }
  const type = (isNonEmptyString(b.type) ? b.type : "programado") as AlertTipo;
  if (!ALERT_TIPOS.includes(type)) {
    return { ok: false, error: "type de alerta inválido." };
  }
  const priority = (
    isNonEmptyString(b.priority) ? b.priority : "media"
  ) as AlertPrioridad;
  if (!ALERT_PRIORIDADES.includes(priority)) {
    return { ok: false, error: "priority inválida." };
  }
  return {
    ok: true,
    data: {
      type,
      message: b.message.trim(),
      dueDate: b.dueDate,
      priority,
      tagId: typeof b.tagId === "string" ? b.tagId.trim() || undefined : undefined,
      animalId: typeof b.animalId === "string" ? b.animalId : undefined,
      tratamientoId:
        typeof b.tratamientoId === "string" ? b.tratamientoId : undefined,
    },
  };
}

export function parseUpdateAlert(
  body: unknown
): ValidationResult<UpdateAlertInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const b = body as Record<string, unknown>;
  const data: UpdateAlertInput = {};
  if (typeof b.message === "string") data.message = b.message.trim();
  if (typeof b.dueDate === "string") data.dueDate = b.dueDate;
  if (typeof b.type === "string") data.type = b.type as AlertTipo;
  if (typeof b.priority === "string")
    data.priority = b.priority as AlertPrioridad;
  if (typeof b.status === "string")
    data.status = b.status as UpdateAlertInput["status"];
  if (typeof b.tagId === "string") data.tagId = b.tagId.trim();
  if (typeof b.animalId === "string") data.animalId = b.animalId;
  return { ok: true, data };
}

export function parseCreateMedicamento(
  body: unknown
): ValidationResult<CreateMedicamentoInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.name)) {
    return { ok: false, error: "name es obligatorio." };
  }
  const pricePerUnit = asNumber(b.pricePerUnit) ?? 0;
  if (pricePerUnit < 0) {
    return { ok: false, error: "pricePerUnit inválido." };
  }
  return {
    ok: true,
    data: {
      name: b.name.trim(),
      code: typeof b.code === "string" ? b.code.trim() : undefined,
      type: typeof b.type === "string" ? b.type : "vacuna",
      unit: typeof b.unit === "string" ? b.unit : "dosis",
      pricePerUnit,
    },
  };
}
