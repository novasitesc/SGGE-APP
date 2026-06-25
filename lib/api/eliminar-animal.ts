import type { SupabaseClient } from "@supabase/supabase-js";
import { ANIMAL_SELECT, normalizeAnimalRow } from "@/lib/api/animales-query";
import { adjustCorralOcupacion } from "@/lib/api/corrales-helpers";
import {
  registrarHistorialAnimal,
  snapshotFromAnimalRow,
} from "@/lib/api/historial-animal";
import type { AprobadorVerificado } from "@/lib/api/aprobacion";
import { nombreCompleto } from "@/lib/api/aprobacion";

export type EjecutarBajaAnimalInput = {
  granjaId: string;
  animalId: string;
  justificacion: string;
  aprobador: AprobadorVerificado;
  solicitante?: {
    nombre: string;
    email?: string | null;
    cargo?: string | null;
  };
};

export async function ejecutarBajaAnimal(
  admin: SupabaseClient,
  input: EjecutarBajaAnimalInput
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const { granjaId, animalId, justificacion, aprobador, solicitante } = input;

  const { data: animal, error: e0 } = await admin
    .from("animales")
    .select(ANIMAL_SELECT)
    .eq("granja_id", granjaId)
    .eq("id", animalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!animal) return { ok: false, message: "Animal no encontrado.", status: 404 };

  const normalized = normalizeAnimalRow(animal as Record<string, unknown>);
  const estado = normalized.estados_animales?.codigo ?? "activo";

  if (estado === "vendido" || estado === "muerto") {
    return {
      ok: false,
      message: `No se puede eliminar un animal en estado '${estado}'.`,
      status: 409,
    };
  }

  const { data: venta } = await admin
    .from("detalle_ventas")
    .select("id")
    .eq("animal_id", animalId)
    .maybeSingle();
  if (venta) {
    return {
      ok: false,
      message: "No se puede eliminar: el animal tiene registro de venta.",
      status: 409,
    };
  }

  const { error } = await admin
    .from("animales")
    .update({ deleted_at: new Date().toISOString() })
    .eq("granja_id", granjaId)
    .eq("id", animalId);
  if (error) return { ok: false, message: error.message, status: 400 };

  const corralId = normalized.corral_id;
  if (corralId && estado === "activo") {
    await adjustCorralOcupacion(admin, corralId, -1);
  }

  const snap = snapshotFromAnimalRow(normalized);
  const aprobadorNombre = nombreCompleto(aprobador);
  const solicitanteTexto = solicitante
    ? ` · Solicitado por ${solicitante.nombre}${solicitante.cargo ? ` (${solicitante.cargo})` : ""}`
    : "";

  await registrarHistorialAnimal(admin, {
    granjaId,
    animalId,
    arete: normalized.arete,
    accion: "eliminar",
    resumen: `Baja aprobada por ${aprobadorNombre} (${aprobador.rolCodigo})${solicitanteTexto}: ${justificacion}`,
    datosAnteriores: snap,
    datosNuevos: {
      justificacion,
      aprobadoPor: aprobadorNombre,
      aprobadoPorEmail: aprobador.email,
      rolAprobador: aprobador.rolCodigo,
      fechaAprobacion: new Date().toISOString(),
      solicitante: solicitante ?? null,
    },
    usuarioId: aprobador.usuarioId,
  });

  return { ok: true };
}
