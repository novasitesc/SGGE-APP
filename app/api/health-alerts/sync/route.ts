import { requireApiContext } from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";
import {
  listTratamientos,
  syncCarenciaYNotificaciones,
} from "@/modules/salud";

export const dynamic = "force-dynamic";

/**
 * Regenera alertas desde proxima_aplicacion y sincroniza carencias
 * (listo_traslado + notificaciones a usuarios).
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const treatments = await listTratamientos(admin, granjaId);
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    for (const t of treatments) {
      if (!t.nextDue || t.nextDue < today) continue;

      const { data: existing } = await admin
        .from("alertas_sanitarias")
        .select("id")
        .eq("granja_id", granjaId)
        .eq("tratamiento_id", t.id)
        .eq("tipo", "tratamiento")
        .eq("estado", "activa")
        .is("deleted_at", null)
        .maybeSingle();

      if (existing?.id) {
        await admin
          .from("alertas_sanitarias")
          .update({
            mensaje: `Próxima aplicación: ${t.name}`,
            fecha_vencimiento: t.nextDue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        continue;
      }

      const { error } = await admin.from("alertas_sanitarias").insert({
        granja_id: granjaId,
        animal_id: t.animalId ?? null,
        tipo: "tratamiento",
        mensaje: `Próxima aplicación: ${t.name}`,
        fecha_vencimiento: t.nextDue,
        prioridad: "media",
        estado: "activa",
        tratamiento_id: t.id,
      });
      if (!error) created += 1;
    }

    const carencia = await syncCarenciaYNotificaciones(
      admin,
      granjaId,
      treatments
    );

    return jsonOk({
      created,
      carenciaUpdated: carencia.updated,
      carenciaNotified: carencia.notified,
      carenciaAlerts: carencia.alerts,
    });
  } catch (e) {
    return jsonServerError("health-alerts/sync", e);
  }
}
