import { isUuid, getSystemUserId } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { registrarHistorialAnimal } from "@/lib/api/historial-animal";
import { normalizeWeightKg } from "@/lib/api/weight-utils";
import { upsertPesajeAnimal } from "@/lib/api/pesaje-utils";

export const dynamic = "force-dynamic";

type PostBody = {
  weightKg?: number;
  measuredAt?: string | null;
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const { data: animal, error: e0 } = await admin
      .from("animales")
      .select("id")
      .eq("granja_id", granjaId)
      .eq("id", animalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const { data: pesajes, error } = await admin
      .from("pesajes")
      .select("id, fecha_pesaje, peso_kg, tipo_pesaje")
      .eq("animal_id", animalId)
      .is("deleted_at", null)
      .order("fecha_pesaje", { ascending: false });
    if (error) throw new Error(error.message);

    return jsonOk({
      pesajes: (pesajes ?? []).map((p) => ({
        id: p.id,
        fecha: p.fecha_pesaje,
        pesoKg: Number(p.peso_kg),
        tipo: p.tipo_pesaje,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: animalId } = await ctx.params;
    if (!isUuid(animalId)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as PostBody;

    if (body.weightKg == null || body.weightKg <= 0) {
      return jsonError("weightKg debe ser > 0.");
    }
    const pesoKg = normalizeWeightKg(body.weightKg);

    const { data: animal, error: e0 } = await admin
      .from("animales")
      .select("id, arete")
      .eq("granja_id", granjaId)
      .eq("id", animalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!animal) return jsonError("Animal no encontrado.", 404);

    const fechaPesaje = body.measuredAt
      ? body.measuredAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const pesajeResult = await upsertPesajeAnimal(admin, {
      animalId,
      fechaPesaje,
      pesoKg,
      tipoPesaje: "rutina",
      registradoPorId: getSystemUserId(),
    });
    if (!pesajeResult.ok) return jsonError(pesajeResult.message, 400);

    const { data: row } = await admin
      .from("pesajes")
      .select("*")
      .eq("animal_id", animalId)
      .eq("fecha_pesaje", fechaPesaje)
      .is("deleted_at", null)
      .single();
    if (!row) return jsonError("No se pudo registrar el pesaje.", 500);

    await registrarHistorialAnimal(admin, {
      granjaId,
      animalId,
      arete: (animal as { arete: string }).arete,
      accion: "pesaje",
      resumen: `Pesaje ${fechaPesaje}: ${pesoKg} kg (rutina).`,
      datosNuevos: {
        fecha: fechaPesaje,
        pesoKg,
        tipo: "rutina",
        pesajeId: row.id,
      },
    });

    return jsonOk(
      {
        id: row.id,
        animalId: row.animal_id,
        weightKg: Number(row.peso_kg),
        measuredAt: row.fecha_pesaje,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
