import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  getEstadoIdByCodigo,
  liberarCodigoSoftDeleted,
  nextCodigoForTipo,
} from "@/lib/api/corrales-helpers";
import {
  registrarHistorial,
  snapshotCorral,
} from "@/lib/api/historial-sistema";
import { MODULE_TYPE_OPTIONS } from "@/lib/modulos/constants";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const estadoActivo = await getEstadoIdByCodigo(admin, "activo");

    const [{ data: corrales, error: e1 }, { data: animales, error: e2 }] =
      await Promise.all([
        admin
          .from("corrales")
          .select("*")
          .eq("granja_id", granjaId)
          .is("deleted_at", null)
          .order("codigo", { ascending: true }),
        admin
          .from("animales")
          .select("id, corral_id, estado_id, peso_actual_kg")
          .eq("granja_id", granjaId)
          .is("deleted_at", null),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const list = (corrales ?? []).map((m: Record<string, unknown>) => {
      const cid = m.id as string;
      const active = (animales ?? []).filter(
        (a: { corral_id: string | null; estado_id: string }) =>
          a.corral_id === cid && a.estado_id === estadoActivo
      );
      const avgWeight =
        active.length > 0
          ? Math.round(
              active.reduce(
                (s: number, a: { peso_actual_kg: number }) =>
                  s + Number(a.peso_actual_kg),
                0
              ) / active.length
            )
          : 0;
      return {
        id: m.codigo as string,
        uuid: cid,
        name: m.nombre,
        type: m.tipo ?? "engorda",
        capacity: m.capacidad_maxima,
        animalCount: active.length,
        avgWeightActive: avgWeight,
      };
    });

    return jsonOk(list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

const VALID_TYPES = new Set(
  MODULE_TYPE_OPTIONS.map((o) => o.value as string)
);

type PostBody = {
  name?: string;
  type?: string;
  capacity?: number;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
    const body = (await req.json()) as PostBody;

    if (!body.name?.trim()) return jsonError("name es obligatorio.");
    if (body.capacity == null || body.capacity <= 0) {
      return jsonError("capacity debe ser > 0.");
    }

    const tipo = (body.type ?? "engorda").trim();
    if (!VALID_TYPES.has(tipo)) {
      return jsonError(`Tipo de módulo inválido: ${tipo}.`);
    }

    const codigo = await nextCodigoForTipo(admin, granjaId, tipo);
    const payload = {
      granja_id: granjaId,
      codigo,
      nombre: body.name.trim(),
      tipo,
      capacidad_maxima: body.capacity,
      ocupacion_actual: 0,
      activo: true,
    };

    let { data, error } = await admin
      .from("corrales")
      .insert(payload)
      .select("*")
      .single();

    // Compat: UNIQUE global antiguo bloquea códigos soft-deleted hasta aplicar la migración.
    if (error?.code === "23505") {
      await liberarCodigoSoftDeleted(admin, granjaId, codigo);
      const retry = await admin
        .from("corrales")
        .insert(payload)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === "23505") {
        return jsonError(
          `Ya existe un módulo activo con el código '${codigo}'.`
        );
      }
      return jsonError(error.message, 400);
    }

    await registrarHistorial(admin, {
      granjaId,
      modulo: "modulos",
      registroId: data.id,
      referencia: data.codigo,
      accion: "crear",
      resumen: `Corral creado: ${data.codigo} — ${data.nombre} (cap. ${data.capacidad_maxima}).`,
      datosNuevos: snapshotCorral(data),
    });

    return jsonOk(
      {
        id: data.codigo,
        uuid: data.id,
        name: data.nombre,
        type: data.tipo,
        capacity: data.capacidad_maxima,
        animalCount: 0,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
