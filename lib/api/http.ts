import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";

/** Tamaño máximo aceptado en cualquier subida de archivo de la API. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { status: 200, ...init });
}

/**
 * Respuesta para el `catch` final de un route handler. Un `ApiError` conserva su
 * mensaje y su código; cualquier otro fallo se registra en el servidor y se
 * devuelve genérico, porque los `error.message` de Postgres describen tablas,
 * columnas y restricciones.
 */
export function jsonServerError(contexto: string, e: unknown) {
  if (e instanceof ApiError) return jsonError(e.message, e.status);

  const detalle = e instanceof Error ? e.message : String(e);
  console.error(`[${contexto}]`, detalle);
  return jsonError(
    "No se pudo completar la operación. Intente de nuevo o contacte al administrador.",
    500
  );
}
