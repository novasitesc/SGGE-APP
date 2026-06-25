import { jsonError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function PATCH() {
  return jsonError(
    "Alertas sanitarias disponibles en la Fase 4 (módulo salud).",
    501
  );
}
