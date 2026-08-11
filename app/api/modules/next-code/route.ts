
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { nextCodigoForTipo } from "@/lib/api/corrales-helpers";
import { MODULE_TYPE_OPTIONS } from "@/lib/modulos/constants";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(
  MODULE_TYPE_OPTIONS.map((o) => o.value as string)
);

/** Vista previa del siguiente código único para un tipo de módulo. */
export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const tipo = (url.searchParams.get("type") ?? "engorda").trim();
    if (!VALID_TYPES.has(tipo)) {
      return jsonError(`Tipo de módulo inválido: ${tipo}.`);
    }

    const excludeId = url.searchParams.get("excludeId")?.trim() || undefined;
    const code = await nextCodigoForTipo(admin, granjaId, tipo, excludeId);
    return jsonOk({ code });
  } catch (e) {
    return jsonServerError("modules/next-code", e);
  }
}
