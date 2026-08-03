/** Códigos que el sistema usa en lógica de negocio. */
export const ESTADOS_SISTEMA = new Set([
  "activo",
  "vendido",
  "muerto",
  "enfermo",
]);

export type EstadoAnimalRow = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export function mapEstadoRow(raw: Record<string, unknown>): EstadoAnimalRow {
  const codigo = String(raw.codigo ?? "");
  const activo =
    raw.activo != null
      ? Boolean(raw.activo)
      : raw.activa != null
        ? Boolean(raw.activa)
        : true;
  return {
    id: String(raw.id),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    activo,
  };
}
