import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapCostRow } from "@/lib/api/mappers";
import {
  registrarHistorial,
  snapshotGasto,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

const CATEGORIA_MAP: Record<string, string> = {
  alimentación: "ALIM",
  alimentacion: "ALIM",
  transporte: "TRANS",
  mano_de_obra: "MO",
  vacunas: "VET",
  medicamentos: "VET",
  servicios: "MANT",
  otros: "OTRO",
};

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data, error } = await admin
      .from("gastos")
      .select("id, fecha, concepto, monto, categorias_gastos(codigo, nombre)")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map(mapCostRow));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  category?: string;
  description?: string;
  amount?: number;
  date?: string;
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

    if (!body.category) return jsonError("category es obligatorio.");
    if (!body.description?.trim()) return jsonError("description es obligatorio.");
    if (body.amount == null || body.amount < 0) {
      return jsonError("amount debe ser un número >= 0.");
    }
    if (!body.date) return jsonError("date es obligatorio.");

    const catCodigo =
      CATEGORIA_MAP[body.category.toLowerCase()] ?? body.category.toUpperCase();

    const { data: categoria, error: e0 } = await admin
      .from("categorias_gastos")
      .select("id")
      .eq("codigo", catCodigo)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!categoria) {
      return jsonError(`Categoría '${body.category}' no encontrada.`);
    }

    const { data, error } = await admin
      .from("gastos")
      .insert({
        granja_id: granjaId,
        categoria_id: categoria.id,
        fecha: body.date,
        concepto: body.description.trim(),
        monto: body.amount,
      })
      .select("id, fecha, concepto, monto, categorias_gastos(codigo, nombre)")
      .single();
    if (error) return jsonError(error.message, 400);

    const mapped = mapCostRow(data);
    const catInsert = (data as Record<string, unknown>).categorias_gastos;
    const catObj = Array.isArray(catInsert) ? catInsert[0] : catInsert;

    await registrarHistorial(admin, {
      granjaId,
      modulo: "costos",
      registroId: mapped.id,
      referencia: mapped.description.slice(0, 200),
      accion: "crear",
      resumen: `Gasto registrado: ${mapped.description} — ₡${mapped.amount} (${mapped.date}).`,
      datosNuevos: snapshotGasto({
        concepto: mapped.description,
        monto: mapped.amount,
        fecha: mapped.date,
        categoria: (catObj as { nombre?: string })?.nombre,
      }),
    });

    return jsonOk(mapped, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
