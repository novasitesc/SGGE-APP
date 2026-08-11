import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { createTratamiento, parseCreateTreatment } from "@/modules/salud";
import { registrarHistorial } from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const { id } = await ctx.params;
    const overrides = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const { data: imp, error } = await admin
      .from("salud_importaciones")
      .select("*")
      .eq("id", id)
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return jsonError(error.message, 400);
    if (!imp) return jsonError("Importación no encontrada.", 404);
    if (imp.estado === "confirmado") {
      return jsonError("Esta importación ya fue confirmada.", 409);
    }

    const parsed = (imp.datos_parseados ?? {}) as Record<string, unknown>;
    const merged = {
      type: overrides.type ?? parsed.type ?? "vacuna",
      name: overrides.name ?? parsed.name ?? "Tratamiento importado",
      date:
        overrides.date ??
        parsed.date ??
        new Date().toISOString().slice(0, 10),
      animalCount: overrides.animalCount ?? parsed.animalCount ?? 1,
      costPerAnimal: overrides.costPerAnimal ?? parsed.costPerAnimal ?? 0,
      totalCost: overrides.totalCost ?? parsed.totalCost,
      appliedBy: overrides.appliedBy ?? parsed.appliedBy ?? "",
      notes: overrides.notes ?? parsed.notes ?? "",
      nextDue: overrides.nextDue ?? parsed.nextDue,
    };

    const validated = parseCreateTreatment(merged);
    if (!validated.ok) return jsonError(validated.error, 400);

    const treatment = await createTratamiento(
      admin,
      granjaId,
      { ...validated.data, origen: "pdf" },
      usuario?.id
    );

    await admin
      .from("salud_importaciones")
      .update({
        estado: "confirmado",
        tratamiento_id: treatment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await registrarHistorial(admin, {
      granjaId,
      modulo: "salud",
      registroId: treatment.id,
      referencia: treatment.name,
      accion: "crear",
      resumen: `Tratamiento confirmado desde PDF: ${treatment.name}`,
      datosNuevos: { importId: id, treatmentId: treatment.id },
      usuarioId: usuario?.id,
    });

    return jsonOk(treatment);
  } catch (e) {
    return jsonServerError("salud/import/[id]/confirm", e);
  }
}
