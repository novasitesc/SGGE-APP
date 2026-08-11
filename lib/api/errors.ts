/**
 * Errores de dominio. Sin dependencias de Next para que la lógica de negocio
 * pueda lanzarlos sin arrastrar `next/server`.
 */

/**
 * Error cuyo mensaje sí puede llegar al cliente: validación, falta de
 * configuración o recurso inexistente. `jsonServerError` lo distingue de un
 * fallo inesperado, cuyo detalle nunca sale del servidor.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
