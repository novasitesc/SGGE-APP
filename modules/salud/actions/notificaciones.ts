import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARENCIA_AVISO_DIAS,
  todayIso,
  type CarenciaComputed,
} from "../lib/carencia";
import type { TreatmentRecord } from "../types/salud.types";

export type NotificacionTipo =
  | "carencia_inscrita"
  | "carencia_proxima"
  | "carencia_vencida";

export type NotificacionUsuario = {
  id: string;
  tipo: NotificacionTipo | string;
  titulo: string;
  mensaje: string;
  tratamientoId?: string | null;
  animalId?: string | null;
  fechaEvento?: string | null;
  leidaAt?: string | null;
  createdAt: string;
};

async function listUsuariosActivosGranja(
  admin: SupabaseClient,
  granjaId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("usuarios")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("activo", true)
    .is("deleted_at", null);
  if (error) return [];
  return (data ?? []).map((u: { id: string }) => u.id);
}

async function upsertNotificacion(
  admin: SupabaseClient,
  row: {
    granja_id: string;
    usuario_id: string;
    tipo: NotificacionTipo;
    titulo: string;
    mensaje: string;
    tratamiento_id: string;
    animal_id?: string | null;
    fecha_evento?: string | null;
  }
): Promise<boolean> {
  const { data: existing } = await admin
    .from("notificaciones_usuario")
    .select("id")
    .eq("usuario_id", row.usuario_id)
    .eq("tipo", row.tipo)
    .eq("tratamiento_id", row.tratamiento_id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("notificaciones_usuario")
      .update({
        titulo: row.titulo,
        mensaje: row.mensaje,
        animal_id: row.animal_id ?? null,
        fecha_evento: row.fecha_evento ?? null,
      })
      .eq("id", existing.id);
    return !error;
  }

  const { error } = await admin.from("notificaciones_usuario").insert(row);
  return !error;
}

async function notifyGranja(
  admin: SupabaseClient,
  granjaId: string,
  payload: {
    tipo: NotificacionTipo;
    titulo: string;
    mensaje: string;
    tratamientoId: string;
    animalId?: string | null;
    fechaEvento?: string | null;
  }
): Promise<number> {
  const usuarios = await listUsuariosActivosGranja(admin, granjaId);
  let n = 0;
  for (const usuarioId of usuarios) {
    const ok = await upsertNotificacion(admin, {
      granja_id: granjaId,
      usuario_id: usuarioId,
      tipo: payload.tipo,
      titulo: payload.titulo,
      mensaje: payload.mensaje,
      tratamiento_id: payload.tratamientoId,
      animal_id: payload.animalId ?? null,
      fecha_evento: payload.fechaEvento ?? null,
    });
    if (ok) n += 1;
  }
  return n;
}

/** Notifica al inscribir un tratamiento con carencia activa. */
export async function notifyCarenciaInscrita(
  admin: SupabaseClient,
  granjaId: string,
  treatment: TreatmentRecord,
  carencia: CarenciaComputed
): Promise<void> {
  if (!carencia.fechaFinCarencia || carencia.diasCarencia <= 0) return;

  await notifyGranja(admin, granjaId, {
    tipo: "carencia_inscrita",
    titulo: `Carencia: ${treatment.name}`,
    mensaje: carencia.listoTraslado
      ? `${treatment.name} sin restricción vigente. Listo para traslado/subasta.`
      : `${treatment.name} aplicado el ${treatment.date}. Carencia ${carencia.diasCarencia} días — listo para traslado/subasta a partir del ${carencia.fechaFinCarencia}.`,
    tratamientoId: treatment.id,
    animalId: treatment.animalId,
    fechaEvento: carencia.fechaFinCarencia,
  });
}

/**
 * Recalcula listo_traslado, genera alertas de carencia y notifica
 * (D-3 próxima / D0 vencida) a usuarios de la granja.
 */
export async function syncCarenciaYNotificaciones(
  admin: SupabaseClient,
  granjaId: string,
  treatments: TreatmentRecord[]
): Promise<{ updated: number; notified: number; alerts: number }> {
  const today = todayIso();
  let updated = 0;
  let notified = 0;
  let alerts = 0;

  for (const t of treatments) {
    if (!t.fechaFinCarencia) continue;

    const listo = t.fechaFinCarencia <= today;
    if (t.listoTraslado !== listo) {
      const { error } = await admin
        .from("tratamientos")
        .update({
          listo_traslado: listo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      if (!error) {
        updated += 1;
        t.listoTraslado = listo;
      }
    }

    const mensajeAlerta = listo
      ? `Fin de carencia: ${t.name} — apto para traslado/subasta (${t.fechaFinCarencia}).`
      : `En carencia: ${t.name} — no trasladar hasta ${t.fechaFinCarencia}.`;

    const { data: existingAlert } = await admin
      .from("alertas_sanitarias")
      .select("id")
      .eq("granja_id", granjaId)
      .eq("tratamiento_id", t.id)
      .eq("tipo", "carencia")
      .eq("estado", "activa")
      .is("deleted_at", null)
      .maybeSingle();

    if (existingAlert?.id) {
      await admin
        .from("alertas_sanitarias")
        .update({
          mensaje: mensajeAlerta,
          fecha_vencimiento: t.fechaFinCarencia,
          prioridad: listo ? "baja" : "alta",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAlert.id);
    } else if (!listo || t.fechaFinCarencia >= today) {
      const { error } = await admin.from("alertas_sanitarias").insert({
        granja_id: granjaId,
        animal_id: t.animalId ?? null,
        tipo: "carencia",
        mensaje: mensajeAlerta,
        fecha_vencimiento: t.fechaFinCarencia,
        prioridad: listo ? "baja" : "alta",
        estado: "activa",
        tratamiento_id: t.id,
      });
      if (!error) alerts += 1;
    }

    // Aviso D-CARENCIA_AVISO_DIAS … D0
    const ms =
      new Date(t.fechaFinCarencia + "T00:00:00Z").getTime() -
      new Date(today + "T00:00:00Z").getTime();
    const daysLeft = Math.round(ms / 86_400_000);

    if (daysLeft === 0 || (listo && daysLeft <= 0)) {
      notified += await notifyGranja(admin, granjaId, {
        tipo: "carencia_vencida",
        titulo: `Listo para traslado: ${t.name}`,
        mensaje: `Terminó la carencia de ${t.name}. El animal/hato puede trasladarse a subasta o venta.`,
        tratamientoId: t.id,
        animalId: t.animalId,
        fechaEvento: t.fechaFinCarencia,
      });
    } else if (daysLeft > 0 && daysLeft <= CARENCIA_AVISO_DIAS) {
      notified += await notifyGranja(admin, granjaId, {
        tipo: "carencia_proxima",
        titulo: `Carencia por vencer: ${t.name}`,
        mensaje: `${t.name}: faltan ${daysLeft} día${daysLeft === 1 ? "" : "s"} de carencia. Listo para traslado el ${t.fechaFinCarencia}.`,
        tratamientoId: t.id,
        animalId: t.animalId,
        fechaEvento: t.fechaFinCarencia,
      });
    }
  }

  return { updated, notified, alerts };
}

export async function listNotificacionesUsuario(
  admin: SupabaseClient,
  usuarioId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {}
): Promise<NotificacionUsuario[]> {
  let query = admin
    .from("notificaciones_usuario")
    .select(
      "id, tipo, titulo, mensaje, tratamiento_id, animal_id, fecha_evento, leida_at, created_at"
    )
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 40);

  if (opts.unreadOnly) query = query.is("leida_at", null);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    tipo: r.tipo as string,
    titulo: r.titulo as string,
    mensaje: r.mensaje as string,
    tratamientoId: (r.tratamiento_id as string) ?? null,
    animalId: (r.animal_id as string) ?? null,
    fechaEvento: (r.fecha_evento as string) ?? null,
    leidaAt: (r.leida_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function countNotificacionesNoLeidas(
  admin: SupabaseClient,
  usuarioId: string
): Promise<number> {
  const { count, error } = await admin
    .from("notificaciones_usuario")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .is("leida_at", null);
  if (error) {
    if (error.code === "42P01") return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function markNotificacionLeida(
  admin: SupabaseClient,
  usuarioId: string,
  id: string
): Promise<void> {
  const { error } = await admin
    .from("notificaciones_usuario")
    .update({ leida_at: new Date().toISOString() })
    .eq("id", id)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error(error.message);
}

export async function markAllNotificacionesLeidas(
  admin: SupabaseClient,
  usuarioId: string
): Promise<void> {
  const { error } = await admin
    .from("notificaciones_usuario")
    .update({ leida_at: new Date().toISOString() })
    .eq("usuario_id", usuarioId)
    .is("leida_at", null);
  if (error) throw new Error(error.message);
}
