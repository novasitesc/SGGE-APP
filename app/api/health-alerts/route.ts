import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** Alertas sanitarias: pendiente de tabla dedicada en SRRG. */
export async function GET(req: Request) {
  try {
    await resolveGranjaId(
      createSupabaseAdmin(),
      new URL(req.url).searchParams.get("farmId")
    );
    return jsonOk([]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function POST() {
  return jsonError(
    "Alertas sanitarias disponibles en la Fase 4 (módulo salud).",
    501
  );
}
