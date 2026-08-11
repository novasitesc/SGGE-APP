import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { ApiError } from "@/lib/api/errors";
import { computeCarencia } from "../lib/carencia";
import { mapTreatment, snapshotTratamiento } from "../queries/mappers";
import { findOrCreateMedicamento } from "../queries/medicamentos";
import type {
  CreateTreatmentInput,
  TreatmentRecord,
  UpdateTreatmentInput,
} from "../types/salud.types";
import { notifyCarenciaInscrita } from "./notificaciones";

async function resolveDiasCarencia(
  admin: SupabaseClient,
  medicamentoId: string | null,
  override?: number
): Promise<number> {
  if (override != null && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }
  if (!medicamentoId) return 0;
  const { data } = await admin
    .from("medicamentos")
    .select("periodo_carencia_dias")
    .eq("id", medicamentoId)
    .maybeSingle();
  return Math.max(0, Math.floor(Number(data?.periodo_carencia_dias ?? 0) || 0));
}

async function syncAlertFromNextDue(
  admin: SupabaseClient,
  granjaId: string,
  treatment: TreatmentRecord
): Promise<void> {
  if (!treatment.nextDue) return;

  const mensaje = `Próxima aplicación: ${treatment.name}`;
  const { data: existing } = await admin
    .from("alertas_sanitarias")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("tratamiento_id", treatment.id)
    .eq("tipo", "tratamiento")
    .eq("estado", "activa")
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("alertas_sanitarias")
      .update({
        mensaje,
        fecha_vencimiento: treatment.nextDue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  await admin.from("alertas_sanitarias").insert({
    granja_id: granjaId,
    animal_id: treatment.animalId ?? null,
    tipo: "tratamiento",
    mensaje,
    fecha_vencimiento: treatment.nextDue,
    prioridad: "media",
    estado: "activa",
    tratamiento_id: treatment.id,
  });
}

export async function createTratamiento(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateTreatmentInput & { origen?: string },
  usuarioId?: string | null
): Promise<TreatmentRecord> {
  const animalCount = input.animalCount || 1;
  const costPerAnimal = input.costPerAnimal ?? 0;
  const totalCost =
    input.totalCost ?? Math.round(animalCount * costPerAnimal * 100) / 100;

  let medicamentoId = input.medicamentoId ?? null;
  if (!medicamentoId) {
    medicamentoId = await findOrCreateMedicamento(
      admin,
      granjaId,
      input.name,
      String(input.type)
    );
  }

  const primaryAnimalId =
    input.animalId ??
    (input.animalIds && input.animalIds.length > 0
      ? input.animalIds[0]
      : null);

  const diasCarencia = await resolveDiasCarencia(
    admin,
    medicamentoId,
    input.diasCarencia
  );
  const carencia = computeCarencia(input.date, diasCarencia);

  // animal_id es opcional (tratamientos a nivel de hato / stock).
  // Solo se incluye cuando hay UUID concreto.
  const insertRow: Record<string, unknown> = {
    granja_id: granjaId,
    lote_id: input.loteId ?? null,
    medicamento_id: medicamentoId,
    tipo: input.type,
    nombre: input.name,
    fecha_inicio: input.date,
    proxima_aplicacion: input.nextDue ?? null,
    animal_count: animalCount,
    costo_por_animal: costPerAnimal,
    costo_total: totalCost,
    estado: "aplicado",
    aplicado_por: input.appliedBy ?? "",
    observaciones: input.notes ?? "",
    origen: input.origen ?? "manual",
    fecha_fin_carencia: carencia.fechaFinCarencia,
    listo_traslado: carencia.listoTraslado,
    created_by: usuarioId ?? null,
  };
  if (primaryAnimalId) {
    insertRow.animal_id = primaryAnimalId;
  }

  let fullInsert = await admin
    .from("tratamientos")
    .insert(insertRow)
    .select(
      `id, animal_id, medicamento_id, tipo, nombre, fecha_inicio, proxima_aplicacion,
       animal_count, costo_por_animal, costo_total, estado, aplicado_por, observaciones, origen,
       fecha_fin_carencia, listo_traslado,
       medicamentos(nombre, periodo_carencia_dias)`
    )
    .single();

  // Remoto sin columnas de carencia: reintentar sin ellas
  if (
    fullInsert.error &&
    (fullInsert.error.message.includes("fecha_fin_carencia") ||
      fullInsert.error.message.includes("listo_traslado") ||
      fullInsert.error.message.includes("periodo_carencia"))
  ) {
    const { fecha_fin_carencia: _f, listo_traslado: _l, ...withoutCarencia } =
      insertRow;
    fullInsert = await admin
      .from("tratamientos")
      .insert(withoutCarencia)
      .select(
        `id, animal_id, medicamento_id, tipo, nombre, fecha_inicio, proxima_aplicacion,
         animal_count, costo_por_animal, costo_total, estado, aplicado_por, observaciones, origen,
         medicamentos(nombre)`
      )
      .single();
  }

  let row = fullInsert.data as Record<string, unknown> | null;

  // Fallback mínimo si el remoto aún no tiene columnas nuevas
  if (fullInsert.error || !row) {
    const firstError = fullInsert.error?.message ?? "insert falló";
    const minimal: Record<string, unknown> = {
      medicamento_id: medicamentoId,
      fecha_inicio: input.date,
      costo_total: totalCost,
      estado: "aplicado",
      observaciones: [
        input.notes,
        input.appliedBy ? `Aplicado por: ${input.appliedBy}` : "",
        `tipo:${input.type}`,
        `nombre:${input.name}`,
        input.nextDue ? `proxima:${input.nextDue}` : "",
        carencia.fechaFinCarencia
          ? `carencia_hasta:${carencia.fechaFinCarencia}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),
    };
    if (primaryAnimalId) {
      minimal.animal_id = primaryAnimalId;
    }
    const retry = await admin
      .from("tratamientos")
      .insert(minimal)
      .select(
        `id, animal_id, medicamento_id, fecha_inicio, costo_total, estado, observaciones, medicamentos(nombre)`
      )
      .single();
    if (retry.error || !retry.data) {
      throw new Error(retry.error?.message ?? firstError);
    }
    row = retry.data as Record<string, unknown>;
  }

  const mapped = mapTreatment(row);

  const extraIds = (input.animalIds ?? []).filter(
    (id) => id && id !== primaryAnimalId
  );
  if (primaryAnimalId || extraIds.length > 0) {
    const links = [primaryAnimalId, ...extraIds]
      .filter(Boolean)
      .map((animal_id) => ({
        tratamiento_id: mapped.id,
        animal_id,
      }));
    if (links.length > 0) {
      await admin.from("tratamiento_animales").insert(links);
    }
  }

  mapped.fechaFinCarencia = mapped.fechaFinCarencia ?? carencia.fechaFinCarencia;
  mapped.listoTraslado = mapped.listoTraslado ?? carencia.listoTraslado;
  mapped.diasCarencia = diasCarencia;

  await syncAlertFromNextDue(admin, granjaId, mapped);
  await notifyCarenciaInscrita(admin, granjaId, mapped, carencia);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: mapped.id,
    referencia: mapped.name,
    accion: "crear",
    resumen: `Tratamiento registrado: ${mapped.name} (${mapped.animalCount} animales) — ₡${mapped.totalCost}${
      carencia.fechaFinCarencia
        ? ` · carencia hasta ${carencia.fechaFinCarencia}`
        : ""
    }.`,
    datosNuevos: snapshotTratamiento(mapped),
    usuarioId,
  });

  return mapped;
}

export async function updateTratamiento(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: UpdateTreatmentInput,
  usuarioId?: string | null,
  previous?: TreatmentRecord | null
): Promise<TreatmentRecord> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: usuarioId ?? null,
  };
  if (input.name != null) patch.nombre = input.name;
  if (input.type != null) patch.tipo = input.type;
  if (input.date != null) patch.fecha_inicio = input.date;
  if (input.nextDue !== undefined) patch.proxima_aplicacion = input.nextDue ?? null;
  if (input.animalCount != null) patch.animal_count = input.animalCount;
  if (input.costPerAnimal != null) patch.costo_por_animal = input.costPerAnimal;
  if (input.totalCost != null) patch.costo_total = input.totalCost;
  if (input.appliedBy != null) patch.aplicado_por = input.appliedBy;
  if (input.notes != null) patch.observaciones = input.notes;
  if (input.status != null) patch.estado = input.status;
  if (input.animalId !== undefined) patch.animal_id = input.animalId ?? null;
  if (input.medicamentoId !== undefined)
    patch.medicamento_id = input.medicamentoId ?? null;
  if (input.loteId !== undefined) patch.lote_id = input.loteId ?? null;

  if (
    input.totalCost == null &&
    (input.animalCount != null || input.costPerAnimal != null)
  ) {
    const count = input.animalCount ?? previous?.animalCount ?? 1;
    const cpa = input.costPerAnimal ?? previous?.costPerAnimal ?? 0;
    patch.costo_total = Math.round(count * cpa * 100) / 100;
  }

  if (
    input.date != null ||
    input.diasCarencia != null ||
    input.medicamentoId !== undefined
  ) {
    const medId =
      input.medicamentoId !== undefined
        ? input.medicamentoId ?? null
        : previous?.medicamentoId ?? null;
    const dias = await resolveDiasCarencia(admin, medId, input.diasCarencia);
    const fecha = input.date ?? previous?.date ?? new Date().toISOString().slice(0, 10);
    const carencia = computeCarencia(fecha, dias);
    patch.fecha_fin_carencia = carencia.fechaFinCarencia;
    patch.listo_traslado = carencia.listoTraslado;
  }

  const updated = await admin
    .from("tratamientos")
    .update(patch)
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .select(
      `id, animal_id, medicamento_id, tipo, nombre, fecha_inicio, proxima_aplicacion,
       animal_count, costo_por_animal, costo_total, estado, aplicado_por, observaciones, origen,
       fecha_fin_carencia, listo_traslado,
       medicamentos(nombre, periodo_carencia_dias)`
    )
    .single();
  const { error } = updated;
  let data = updated.data;

  if (error) {
    const retry = await admin
      .from("tratamientos")
      .update({
        costo_total: patch.costo_total,
        observaciones: patch.observaciones,
        estado: patch.estado,
        fecha_inicio: patch.fecha_inicio,
        updated_at: patch.updated_at,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select(
        `id, animal_id, medicamento_id, fecha_inicio, costo_total, estado, observaciones, medicamentos(nombre)`
      )
      .single();
    if (retry.error) throw new Error(error.message);
    data = retry.data as typeof data;
  }

  if (!data) throw new ApiError("Tratamiento no encontrado.", 404);
  const mapped = mapTreatment(data as Record<string, unknown>);

  await syncAlertFromNextDue(admin, granjaId, mapped);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: mapped.id,
    referencia: mapped.name,
    accion: "modificar",
    resumen: `Tratamiento actualizado: ${mapped.name}.`,
    datosAnteriores: previous ? snapshotTratamiento(previous) : null,
    datosNuevos: snapshotTratamiento(mapped),
    usuarioId,
  });

  return mapped;
}

export async function softDeleteTratamiento(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  previous: TreatmentRecord | null,
  usuarioId?: string | null
): Promise<void> {
  const { error } = await admin
    .from("tratamientos")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: usuarioId ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  await admin
    .from("alertas_sanitarias")
    .update({
      estado: "resuelta",
      resuelta_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tratamiento_id", id)
    .eq("estado", "activa");

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: id,
    referencia: previous?.name ?? id,
    accion: "eliminar",
    resumen: `Tratamiento eliminado: ${previous?.name ?? id}.`,
    datosAnteriores: previous ? snapshotTratamiento(previous) : null,
    usuarioId,
  });
}

export async function createTratamientosBulk(
  admin: SupabaseClient,
  granjaId: string,
  base: CreateTreatmentInput,
  animalIds: string[],
  usuarioId?: string | null
): Promise<TreatmentRecord> {
  return createTratamiento(
    admin,
    granjaId,
    {
      ...base,
      animalIds,
      animalCount: animalIds.length || base.animalCount,
      origen: "bulk",
    },
    usuarioId
  );
}
