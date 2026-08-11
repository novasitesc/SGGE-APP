import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import {
  insertFlexible,
  nextCatalogCodigo,
} from "@/lib/api/catalog-flexible";
import {
  mapEstadoRow,
  type EstadoAnimalRow,
} from "@/lib/api/estados-helpers";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export type { EstadoAnimalRow };

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin } = auth.ctx;

    const { data, error } = await admin
      .from("estados_animales")
      .select("*")
      .order("codigo", { ascending: true });
    if (error) throw new Error(error.message);

    return jsonOk((data ?? []).map((r) => mapEstadoRow(r as Record<string, unknown>)));
  } catch (e) {
    return jsonServerError("estados-animales", e);
  }
}

type PostBody = {
  nombre?: string;
  codigo?: string;
  activo?: boolean;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(
      auth.ctx.roles,
      "Solo un administrador puede modificar el catálogo de estados."
    );
    if (denied) return denied;
    const { admin } = auth.ctx;
    const body = (await req.json()) as PostBody;

    const nombre = body.nombre?.trim();
    if (!nombre) return jsonError("nombre es obligatorio.");

    const codigo = body.codigo?.trim()
      ? body.codigo.trim().toLowerCase().slice(0, 30)
      : (await nextCatalogCodigo(admin, "estados_animales", null, nombre, "est")).toLowerCase();

    const { data: dup } = await admin
      .from("estados_animales")
      .select("id")
      .ilike("codigo", codigo)
      .maybeSingle();
    if (dup) return jsonError(`Ya existe un estado con el código '${codigo}'.`);

    const { data, error } = await insertFlexible(
      admin,
      "estados_animales",
      {
        codigo,
        nombre,
        activo: body.activo ?? true,
        activa: body.activo ?? true,
      },
      ["codigo"]
    );
    if (error) {
      if (/duplicate|unique|23505/i.test(error)) {
        return jsonError(`Ya existe un estado con el código '${codigo}'.`);
      }
      return jsonError(error, 400);
    }

    return jsonOk(mapEstadoRow(data), { status: 201 });
  } catch (e) {
    return jsonServerError("estados-animales", e);
  }
}
