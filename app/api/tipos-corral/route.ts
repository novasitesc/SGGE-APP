import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import {
  codigoFromNombre,
  insertFlexible,
  nextCatalogCodigo,
} from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import {
  listTiposCorral,
  mapTipoCorralRow,
  type TipoCorralRow,
} from "@/lib/api/tipos-corral-helpers";
import { prefixForModuleType } from "@/lib/modulos/codigo";

export const dynamic = "force-dynamic";

export type { TipoCorralRow };

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin } = auth.ctx;
    const { rows, fromDb } = await listTiposCorral(admin);
    return jsonOk({ items: rows, fromDb });
  } catch (e) {
    return jsonServerError("tipos-corral", e);
  }
}

type PostBody = {
  nombre?: string;
  codigo?: string;
  prefijo?: string;
  activo?: boolean;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(
      auth.ctx.roles,
      "Solo un administrador puede modificar el catálogo de tipos de corral."
    );
    if (denied) return denied;
    const { admin } = auth.ctx;
    const body = (await req.json()) as PostBody;

    const nombre = body.nombre?.trim();
    if (!nombre) return jsonError("nombre es obligatorio.");

    let codigo = body.codigo?.trim()
      ? body.codigo.trim().toLowerCase().slice(0, 40)
      : "";
    if (!codigo) {
      try {
        codigo = (
          await nextCatalogCodigo(admin, "tipos_corral", null, nombre, "tipo")
        ).toLowerCase();
      } catch {
        codigo = codigoFromNombre(nombre, "tipo").toLowerCase();
      }
    }

    const prefijo = (
      body.prefijo?.trim() || prefixForModuleType(codigo)
    )
      .toUpperCase()
      .slice(0, 10);

    const { data: existing } = await admin
      .from("tipos_corral")
      .select("id")
      .is("deleted_at", null)
      .ilike("codigo", codigo)
      .maybeSingle();
    if (existing) {
      return jsonError(`Ya existe un tipo con el código '${codigo}'.`);
    }

    const { data, error, missingTable } = await insertFlexible(
      admin,
      "tipos_corral",
      {
        codigo,
        nombre,
        prefijo,
        activo: body.activo ?? true,
      },
      ["codigo", "nombre"]
    );

    if (missingTable) {
      return jsonError(
        "Tabla tipos_corral no existe. Aplique la migración 20260803120000_tipos_corral.sql.",
        503
      );
    }
    if (error) {
      if (/duplicate|unique|23505/i.test(error)) {
        return jsonError(`Ya existe un tipo con el código '${codigo}'.`);
      }
      return jsonError(error, 400);
    }

    return jsonOk(mapTipoCorralRow(data), { status: 201 });
  } catch (e) {
    return jsonServerError("tipos-corral", e);
  }
}
