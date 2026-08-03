import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { mapAlert, snapshotAlerta } from "../queries/mappers";
import type {
  CreateAlertInput,
  HealthAlertRecord,
  UpdateAlertInput,
} from "../types/salud.types";

export async function createAlerta(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateAlertInput,
  usuarioId?: string | null
): Promise<HealthAlertRecord> {
  const { data, error } = await admin
    .from("alertas_sanitarias")
    .insert({
      granja_id: granjaId,
      animal_id: input.animalId ?? null,
      tag_id: input.tagId ?? null,
      tipo: input.type,
      mensaje: input.message,
      fecha_vencimiento: input.dueDate,
      prioridad: input.priority,
      estado: "activa",
      tratamiento_id: input.tratamientoId ?? null,
      created_by: usuarioId ?? null,
    })
    .select(
      `id, animal_id, tag_id, tipo, mensaje, fecha_vencimiento, prioridad, estado, tratamiento_id`
    )
    .single();

  if (error) throw new Error(error.message);
  const mapped = mapAlert(data as Record<string, unknown>);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: mapped.id,
    referencia: mapped.message.slice(0, 80),
    accion: "crear",
    resumen: `Alerta sanitaria creada (${mapped.priority}): ${mapped.message}`,
    datosNuevos: snapshotAlerta(mapped),
    usuarioId,
  });

  return mapped;
}

export async function updateAlerta(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  input: UpdateAlertInput,
  usuarioId?: string | null,
  previous?: HealthAlertRecord | null
): Promise<HealthAlertRecord> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: usuarioId ?? null,
  };
  if (input.message != null) patch.mensaje = input.message;
  if (input.dueDate != null) patch.fecha_vencimiento = input.dueDate;
  if (input.type != null) patch.tipo = input.type;
  if (input.priority != null) patch.prioridad = input.priority;
  if (input.tagId !== undefined) patch.tag_id = input.tagId ?? null;
  if (input.animalId !== undefined) patch.animal_id = input.animalId ?? null;
  if (input.status != null) {
    patch.estado = input.status;
    if (input.status === "resuelta") {
      patch.resuelta_at = new Date().toISOString();
    }
  }

  const { data, error } = await admin
    .from("alertas_sanitarias")
    .update(patch)
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .select(
      `id, animal_id, tag_id, tipo, mensaje, fecha_vencimiento, prioridad, estado, tratamiento_id`
    )
    .single();

  if (error) throw new Error(error.message);
  const mapped = mapAlert(data as Record<string, unknown>);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: mapped.id,
    referencia: mapped.message.slice(0, 80),
    accion: "modificar",
    resumen: `Alerta sanitaria actualizada: ${mapped.message}`,
    datosAnteriores: previous ? snapshotAlerta(previous) : null,
    datosNuevos: snapshotAlerta(mapped),
    usuarioId,
  });

  return mapped;
}

export async function softDeleteAlerta(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  previous: HealthAlertRecord | null,
  usuarioId?: string | null
): Promise<void> {
  const { error } = await admin
    .from("alertas_sanitarias")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: usuarioId ?? null,
    })
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: id,
    referencia: previous?.message?.slice(0, 80) ?? id,
    accion: "eliminar",
    resumen: `Alerta sanitaria eliminada: ${previous?.message ?? id}`,
    datosAnteriores: previous ? snapshotAlerta(previous) : null,
    usuarioId,
  });
}
