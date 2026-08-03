
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  registrarHistorial,
  snapshotAlimento,
} from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

function mapAlimento(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    code: row.codigo as string,
    name: row.nombre as string,
    type: row.tipo as string,
    unit: row.unidad_medida as string,
    pricePerUnit: Number(row.costo_unitario),
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const { data, error } = await admin
      .from("alimentos")
      .select("*")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);

    return jsonOk((data ?? []).map(mapAlimento));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  code?: string;
  name?: string;
  type?: string;
  unit?: string;
  pricePerUnit?: number;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as PostBody;

    if (!body.name?.trim()) return jsonError("name es obligatorio.");
    if (body.pricePerUnit == null || body.pricePerUnit < 0) {
      return jsonError("pricePerUnit inválido.");
    }

    const codigo =
      body.code?.trim().toUpperCase() ??
      `ALM-${body.name.slice(0, 6).toUpperCase().replace(/\s/g, "")}`;

    const { data, error } = await admin
      .from("alimentos")
      .insert({
        granja_id: granjaId,
        codigo,
        nombre: body.name.trim(),
        tipo: body.type ?? "forraje",
        unidad_medida: body.unit ?? "kg",
        costo_unitario: body.pricePerUnit,
      })
      .select("*")
      .single();
    if (error) return jsonError(error.message, 400);

    const mapped = mapAlimento(data as Record<string, unknown>);
    await registrarHistorial(admin, {
      granjaId,
      modulo: "alimentacion",
      registroId: mapped.id,
      referencia: mapped.name,
      accion: "crear",
      resumen: `Alimento registrado: ${mapped.name} — ₡${mapped.pricePerUnit}/${mapped.unit}.`,
      datosNuevos: snapshotAlimento({
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        costo_unitario: Number(data.costo_unitario),
        unidad_medida: data.unidad_medida,
      }),
    });

    return jsonOk(mapped, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
