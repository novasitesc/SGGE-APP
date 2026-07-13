import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import { nextCodigoForTipo } from "@/lib/api/corrales-helpers";
import { MODULE_TYPE_OPTIONS } from "@/lib/modulos/constants";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(
  MODULE_TYPE_OPTIONS.map((o) => o.value as string)
);

/** Vista previa del siguiente código único para un tipo de módulo. */
export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );
    const tipo = (url.searchParams.get("type") ?? "engorda").trim();
    if (!VALID_TYPES.has(tipo)) {
      return jsonError(`Tipo de módulo inválido: ${tipo}.`);
    }

    const excludeId = url.searchParams.get("excludeId")?.trim() || undefined;
    const code = await nextCodigoForTipo(admin, granjaId, tipo, excludeId);
    return jsonOk({ code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
