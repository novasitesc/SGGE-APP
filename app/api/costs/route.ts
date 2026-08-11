import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { mapCostRow } from "@/lib/api/mappers";
import {
  registrarHistorial,
  snapshotGasto,
} from "@/lib/api/historial-sistema";
import { costCategoryLabel, resolveCategoriaCodigo } from "@/lib/costs/categories";

export const dynamic = "force-dynamic";

function isValidISODate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let query = admin
      .from("gastos")
      .select("id, fecha, concepto, monto, categorias_gastos(codigo, nombre)")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("fecha", { ascending: false });

    if (isValidISODate(from)) query = query.gte("fecha", from);
    if (isValidISODate(to)) query = query.lte("fecha", to);

    const { data, error } = await query;
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
    return jsonServerError("costs", e);
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
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PostBody;

    if (!body.category) return jsonError("category es obligatorio.");
    if (!body.description?.trim()) return jsonError("description es obligatorio.");
    if (body.amount == null || body.amount < 0) {
      return jsonError("amount debe ser un número >= 0.");
    }
    if (!body.date) return jsonError("date es obligatorio.");

    const catCodigo = resolveCategoriaCodigo(body.category);

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
    return jsonServerError("costs", e);
  }
}
