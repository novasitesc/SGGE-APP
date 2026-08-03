import { requireAdmin, requireApiContext } from "@/lib/api/auth";
import {
  insertFlexible,
  nextCatalogCodigo,
} from "@/lib/api/catalog-flexible";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export type CategoriaAnimalRow = {
  id: string;
  codigo: string;
  nombre: string;
  peso_min_kg: number | null;
  peso_max_kg: number | null;
  activa: boolean;
};

function mapRow(raw: Record<string, unknown>): CategoriaAnimalRow {
  const codigo = String(raw.codigo ?? "");
  return {
    id: String(raw.id),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    peso_min_kg:
      raw.peso_min_kg == null || raw.peso_min_kg === ""
        ? null
        : Number(raw.peso_min_kg),
    peso_max_kg:
      raw.peso_max_kg == null || raw.peso_max_kg === ""
        ? null
        : Number(raw.peso_max_kg),
    activa: raw.activa == null ? true : Boolean(raw.activa),
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const { data, error } = await admin
      .from("categorias_animales")
      .select("*")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("codigo", { ascending: true });
    if (error) throw new Error(error.message);

    return jsonOk((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  nombre?: string;
  codigo?: string;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  activa?: boolean;
};

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const denied = requireAdmin(
      auth.ctx.roles,
      "Solo un administrador puede modificar el catálogo de categorías."
    );
    if (denied) return denied;
    const { admin, granjaId } = auth.ctx;
    const body = (await req.json()) as PostBody;

    const nombre = body.nombre?.trim();
    if (!nombre) return jsonError("nombre es obligatorio.");

    const codigo = body.codigo?.trim()
      ? body.codigo.trim().toUpperCase().slice(0, 20)
      : await nextCatalogCodigo(admin, "categorias_animales", granjaId, nombre, "CAT");

    const { data: dup } = await admin
      .from("categorias_animales")
      .select("id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .ilike("codigo", codigo)
      .maybeSingle();
    if (dup) return jsonError(`Ya existe una categoría con el código '${codigo}'.`);

    const { data, error, missingTable } = await insertFlexible(
      admin,
      "categorias_animales",
      {
        granja_id: granjaId,
        codigo,
        nombre,
        peso_min_kg: body.peso_min_kg ?? null,
        peso_max_kg: body.peso_max_kg ?? null,
        activa: body.activa ?? true,
      },
      ["granja_id", "codigo"]
    );
    if (missingTable) {
      return jsonError("Tabla categorias_animales no disponible.", 500);
    }
    if (error) {
      if (error.includes("23505") || /duplicate|unique/i.test(error)) {
        return jsonError(`Ya existe una categoría con el código '${codigo}'.`);
      }
      return jsonError(error, 400);
    }

    return jsonOk(mapRow(data), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
