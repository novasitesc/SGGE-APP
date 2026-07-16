import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { mapCostRow } from "@/lib/api/mappers";
import {
  registrarHistorial,
  snapshotGasto,
} from "@/lib/api/historial-sistema";
import { normalizeCostCategoryKey, costCategoryLabel } from "@/lib/costs/categories";

export const dynamic = "force-dynamic";

/** Clave UI / legacy → código DB. */
const CATEGORIA_MAP: Record<string, string> = {
  alimentación: "ALIM",
  alimentacion: "ALIM",
  combustible: "COMB",
  mantenimiento: "MANT",
  transporte: "TRANS",
  mano_de_obra: "MO",
  vacunas: "VET",
  medicamentos: "VET",
  servicios: "SERV",
  otros: "OTRO",
  alim: "ALIM",
  comb: "COMB",
  mant: "MANT",
  trans: "TRANS",
  mo: "MO",
  vet: "VET",
  serv: "SERV",
  otro: "OTRO",
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

    const rows = data ?? [];
    const gastoIds = rows.map((r) => r.id as string);

    const origenByGasto = new Map<
      string,
      { id: string; emisor_nombre: string | null; archivo_nombre: string }
    >();
    if (gastoIds.length > 0) {
      const { data: comps, error: eComp } = await admin
        .from("comprobantes")
        .select("id, gasto_id, emisor_nombre, archivo_nombre")
        .eq("granja_id", granjaId)
        .is("deleted_at", null)
        .in("gasto_id", gastoIds);
      if (eComp) throw new Error(eComp.message);
      for (const c of comps ?? []) {
        if (c.gasto_id) {
          origenByGasto.set(c.gasto_id, {
            id: c.id,
            emisor_nombre: c.emisor_nombre,
            archivo_nombre: c.archivo_nombre,
          });
        }
      }
    }

    const mapped = rows.map((row) => {
      const origen = origenByGasto.get(row.id as string);
      return mapCostRow(
        row as Record<string, unknown>,
        origen
          ? {
              source: "comprobante",
              issuer: origen.emisor_nombre,
              comprobanteId: origen.id,
              fileName: origen.archivo_nombre,
            }
          : { source: "manual" }
      );
    });

    return jsonOk(mapped);
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

    const key = normalizeCostCategoryKey(body.category);
    const catCodigo =
      CATEGORIA_MAP[body.category.toLowerCase()] ??
      CATEGORIA_MAP[key] ??
      body.category.toUpperCase();

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

    const mapped = mapCostRow(data as Record<string, unknown>, { source: "manual" });

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
        categoria: costCategoryLabel(mapped.category),
      }),
    });

    return jsonOk(mapped, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
