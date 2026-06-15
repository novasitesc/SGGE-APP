import type { SupabaseClient } from "@supabase/supabase-js";
import { ANIMAL_SELECT, normalizeAnimalRow } from "@/lib/api/animales-query";
import {
  registrarHistorialAnimal,
  snapshotFromAnimalRow,
} from "@/lib/api/historial-animal";
import { ejecutarBajaAnimal } from "@/lib/api/eliminar-animal";
import type { AprobadorVerificado } from "@/lib/api/aprobacion";
import { nombreCompleto } from "@/lib/api/aprobacion";

export type SolicitudEstado = "pendiente" | "aprobada" | "rechazada";
export type SolicitudTipo = "eliminar_animal";

export type SolicitudRow = {
  id: string;
  granja_id: string;
  tipo: SolicitudTipo;
  registro_id: string;
  referencia: string;
  justificacion: string;
  solicitante_nombre: string;
  solicitante_email: string | null;
  solicitante_cargo: string | null;
  datos_registro: Record<string, unknown> | null;
  estado: SolicitudEstado;
  resolucion_notas: string | null;
  aprobador_id: string | null;
  resuelto_at: string | null;
  created_at: string;
  aprobador?: { nombre: string; apellido: string | null; email: string } | null;
};

export type CrearSolicitudEliminarAnimalInput = {
  granjaId: string;
  animalId: string;
  justificacion: string;
  solicitanteNombre: string;
  solicitanteEmail?: string | null;
  solicitanteCargo?: string | null;
};

export function mapSolicitudToApi(row: SolicitudRow) {
  const aprobador = row.aprobador;
  const aprobadorNombre = aprobador
    ? [aprobador.nombre, aprobador.apellido].filter(Boolean).join(" ") || aprobador.email
    : null;

  return {
    id: row.id,
    type: row.tipo,
    typeLabel: row.tipo === "eliminar_animal" ? "Baja de animal" : row.tipo,
    recordId: row.registro_id,
    reference: row.referencia,
    justification: row.justificacion,
    requesterName: row.solicitante_nombre,
    requesterEmail: row.solicitante_email,
    requesterRole: row.solicitante_cargo,
    recordData: row.datos_registro,
    status: row.estado,
    resolutionNotes: row.resolucion_notas,
    approverId: row.aprobador_id,
    approverName: aprobadorNombre,
    resolvedAt: row.resuelto_at,
    createdAt: row.created_at,
  };
}

export async function crearSolicitudEliminarAnimal(
  admin: SupabaseClient,
  input: CrearSolicitudEliminarAnimalInput
): Promise<{ ok: true; solicitud: SolicitudRow } | { ok: false; message: string; status: number }> {
  const { granjaId, animalId, justificacion, solicitanteNombre, solicitanteEmail, solicitanteCargo } =
    input;

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
      message: `No se puede solicitar baja de un animal en estado '${estado}'.`,
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
      message: "No se puede solicitar baja: el animal tiene registro de venta.",
      status: 409,
    };
  }

  const { data: pendiente } = await admin
    .from("solicitudes_aprobacion")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("registro_id", animalId)
    .eq("tipo", "eliminar_animal")
    .eq("estado", "pendiente")
    .maybeSingle();
  if (pendiente) {
    return {
      ok: false,
      message: "Ya existe una solicitud de baja pendiente para este animal.",
      status: 409,
    };
  }

  const snap = snapshotFromAnimalRow(normalized);
  const cargoTexto = solicitanteCargo?.trim() ? ` (${solicitanteCargo.trim()})` : "";

  const { data, error } = await admin
    .from("solicitudes_aprobacion")
    .insert({
      granja_id: granjaId,
      tipo: "eliminar_animal",
      registro_id: animalId,
      referencia: normalized.arete,
      justificacion: justificacion.trim(),
      solicitante_nombre: solicitanteNombre.trim(),
      solicitante_email: solicitanteEmail?.trim() || null,
      solicitante_cargo: solicitanteCargo?.trim() || null,
      datos_registro: snap,
      estado: "pendiente",
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("solicitudes_aprobacion") || error.message.includes("does not exist")) {
      return {
        ok: false,
        message:
          "Tabla de solicitudes no configurada. Ejecute docs/database/solicitudes-aprobacion.sql en Supabase.",
        status: 503,
      };
    }
    if (error.code === "23505") {
      return {
        ok: false,
        message: "Ya existe una solicitud de baja pendiente para este animal.",
        status: 409,
      };
    }
    return { ok: false, message: error.message, status: 400 };
  }

  await registrarHistorialAnimal(admin, {
    granjaId,
    animalId,
    arete: normalized.arete,
    accion: "modificar",
    resumen: `Solicitud de baja pendiente por ${solicitanteNombre.trim()}${cargoTexto}: ${justificacion.trim()}`,
    datosAnteriores: snap,
    datosNuevos: {
      solicitudId: data.id,
      estadoSolicitud: "pendiente",
      justificacion: justificacion.trim(),
      solicitante: {
        nombre: solicitanteNombre.trim(),
        email: solicitanteEmail?.trim() || null,
        cargo: solicitanteCargo?.trim() || null,
      },
    },
  });

  return { ok: true, solicitud: data as SolicitudRow };
}

export async function resolverSolicitud(
  admin: SupabaseClient,
  params: {
    granjaId: string;
    solicitudId: string;
    accion: "aprobar" | "rechazar";
    aprobador: AprobadorVerificado;
    notas?: string | null;
  }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const { granjaId, solicitudId, accion, aprobador, notas } = params;

  const { data: solicitud, error: e0 } = await admin
    .from("solicitudes_aprobacion")
    .select("*")
    .eq("granja_id", granjaId)
    .eq("id", solicitudId)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!solicitud) return { ok: false, message: "Solicitud no encontrada.", status: 404 };
  if (solicitud.estado !== "pendiente") {
    return { ok: false, message: "Esta solicitud ya fue resuelta.", status: 409 };
  }

  const row = solicitud as SolicitudRow;
  const aprobadorNombre = nombreCompleto(aprobador);
  const now = new Date().toISOString();

  if (accion === "rechazar") {
    const { error } = await admin
      .from("solicitudes_aprobacion")
      .update({
        estado: "rechazada",
        resolucion_notas: notas?.trim() || null,
        aprobador_id: aprobador.usuarioId,
        resuelto_at: now,
      })
      .eq("id", solicitudId)
      .eq("estado", "pendiente");
    if (error) return { ok: false, message: error.message, status: 400 };

    if (row.tipo === "eliminar_animal") {
      await registrarHistorialAnimal(admin, {
        granjaId,
        animalId: row.registro_id,
        arete: row.referencia,
        accion: "modificar",
        resumen: `Solicitud de baja rechazada por ${aprobadorNombre}: ${notas?.trim() || "Sin comentarios"}`,
        datosAnteriores: row.datos_registro,
        datosNuevos: {
          solicitudId: row.id,
          estadoSolicitud: "rechazada",
          justificacionOriginal: row.justificacion,
          rechazadoPor: aprobadorNombre,
          notas: notas?.trim() || null,
        },
        usuarioId: aprobador.usuarioId,
      });
    }

    return { ok: true };
  }

  if (row.tipo === "eliminar_animal") {
    const result = await ejecutarBajaAnimal(admin, {
      granjaId,
      animalId: row.registro_id,
      justificacion: row.justificacion,
      aprobador,
      solicitante: {
        nombre: row.solicitante_nombre,
        email: row.solicitante_email,
        cargo: row.solicitante_cargo,
      },
    });
    if (!result.ok) return result;
  }

  const { error } = await admin
    .from("solicitudes_aprobacion")
    .update({
      estado: "aprobada",
      resolucion_notas: notas?.trim() || null,
      aprobador_id: aprobador.usuarioId,
      resuelto_at: now,
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");
  if (error) return { ok: false, message: error.message, status: 400 };

  return { ok: true };
}
