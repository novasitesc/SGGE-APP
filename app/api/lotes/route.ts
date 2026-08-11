import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import {
  insertFlexible,
  nextCatalogCodigo,
} from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export type LoteRow = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
};

const ESTADOS_LOTE = new Set(["abierto", "cerrado"]);

function mapRow(raw: Record<string, unknown>): LoteRow {
  const codigo = String(raw.codigo ?? "");
  return {
    id: String(raw.id),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    estado: String(raw.estado ?? "abierto"),
    fecha_apertura: raw.fecha_apertura
      ? String(raw.fecha_apertura).slice(0, 10)
      : null,
    fecha_cierre: raw.fecha_cierre
      ? String(raw.fecha_cierre).slice(0, 10)
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const { data, error } = await admin
      .from("lotes")
      .select("*")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("fecha_apertura", { ascending: false });
    if (error) throw new Error(error.message);

    return jsonOk((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
  } catch (e) {
    return jsonServerError("lotes", e);
  }
}

type PostBody = {
  codigo?: string;
  nombre?: string;
  estado?: string;
  fecha_apertura?: string;
  fecha_cierre?: string | null;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(
      auth.ctx.roles,
      "Solo un administrador puede modificar el catálogo de lotes."
    );
    if (denied) return denied;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PostBody;

    const nombre = body.nombre?.trim() || body.codigo?.trim();
    if (!nombre) return jsonError("nombre o codigo es obligatorio.");

    const codigo = body.codigo?.trim()
      ? body.codigo.trim().toUpperCase().slice(0, 30)
      : await nextCatalogCodigo(admin, "lotes", granjaId, nombre, "LOTE");

    const estado = (body.estado ?? "abierto").trim().toLowerCase();
    if (!ESTADOS_LOTE.has(estado)) {
      return jsonError("estado debe ser 'abierto' o 'cerrado'.");
    }

    const fecha_apertura =
      body.fecha_apertura?.trim() || new Date().toISOString().slice(0, 10);

    const { data: dup } = await admin
      .from("lotes")
      .select("id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .ilike("codigo", codigo)
      .maybeSingle();
    if (dup) return jsonError(`Ya existe un lote con el código '${codigo}'.`);

    const { data, error } = await insertFlexible(
      admin,
      "lotes",
      {
        granja_id: granjaId,
        codigo,
        nombre,
        estado,
        fecha_apertura,
        fecha_cierre: body.fecha_cierre ?? null,
      },
      ["granja_id", "codigo", "estado"]
    );
    if (error) {
      if (/duplicate|unique|23505/i.test(error)) {
        return jsonError(`Ya existe un lote con el código '${codigo}'.`);
      }
      return jsonError(error, 400);
    }

    return jsonOk(mapRow(data), { status: 201 });
  } catch (e) {
    return jsonServerError("lotes", e);
  }
}
