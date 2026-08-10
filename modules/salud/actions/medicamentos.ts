import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { mapMedicamento } from "../queries/mappers";
import type { CreateMedicamentoInput, Medicamento } from "../types/salud.types";

export async function createMedicamento(
  admin: SupabaseClient,
  granjaId: string,
  input: CreateMedicamentoInput,
  usuarioId?: string | null
): Promise<Medicamento> {
  const codigo =
    input.code?.trim().toUpperCase() ||
    `MED-${input.name.slice(0, 8).toUpperCase().replace(/\s/g, "")}`;

  const periodoCarenciaDias = Math.max(
    0,
    Math.floor(input.periodoCarenciaDias ?? 0)
  );

  let { data, error } = await admin
    .from("medicamentos")
    .insert({
      granja_id: granjaId,
      codigo,
      nombre: input.name,
      tipo: input.type ?? "vacuna",
      unidad_medida: input.unit ?? "dosis",
      costo_unitario: input.pricePerUnit,
      periodo_carencia_dias: periodoCarenciaDias,
      manual_uso: input.manualUso?.trim() || null,
      activo: true,
      created_by: usuarioId ?? null,
    })
    .select("*")
    .single();

  // Remoto sin columnas de carencia aún
  if (
    error &&
    (error.message.includes("periodo_carencia") ||
      error.message.includes("manual_uso"))
  ) {
    const retry = await admin
      .from("medicamentos")
      .insert({
        granja_id: granjaId,
        codigo,
        nombre: input.name,
        tipo: input.type ?? "vacuna",
        unidad_medida: input.unit ?? "dosis",
        costo_unitario: input.pricePerUnit,
        activo: true,
        created_by: usuarioId ?? null,
      })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  const mapped = mapMedicamento(data as Record<string, unknown>);
  if (!mapped.periodoCarenciaDias && periodoCarenciaDias > 0) {
    mapped.periodoCarenciaDias = periodoCarenciaDias;
  }

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: mapped.id,
    referencia: mapped.name,
    accion: "crear",
    resumen: `Medicamento registrado: ${mapped.name} — ₡${mapped.pricePerUnit}/${mapped.unit}${
      periodoCarenciaDias > 0
        ? ` · carencia ${periodoCarenciaDias} días`
        : ""
    }.`,
    datosNuevos: {
      codigo: mapped.code,
      nombre: mapped.name,
      tipo: mapped.type,
      costo: mapped.pricePerUnit,
      periodo_carencia_dias: mapped.periodoCarenciaDias,
    },
    usuarioId,
  });

  return mapped;
}

export async function softDeleteMedicamento(
  admin: SupabaseClient,
  granjaId: string,
  id: string,
  name: string,
  usuarioId?: string | null
): Promise<void> {
  const { error } = await admin
    .from("medicamentos")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: usuarioId ?? null,
      activo: false,
    })
    .eq("id", id)
    .eq("granja_id", granjaId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  await registrarHistorial(admin, {
    granjaId,
    modulo: "salud",
    registroId: id,
    referencia: name,
    accion: "eliminar",
    resumen: `Medicamento eliminado: ${name}.`,
    usuarioId,
  });
}
