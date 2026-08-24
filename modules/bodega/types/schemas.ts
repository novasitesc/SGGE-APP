import {
  BODEGA_LINEAS,
  BODEGA_UNIDADES,
  type BodegaLinea,
  type CreateBodegaCompraInput,
} from "./bodega.types";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function parseCreateBodegaCompra(body: unknown): ValidationResult<CreateBodegaCompraInput> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo inválido." };
  }
  const b = body as Record<string, unknown>;
  const linea = typeof b.linea === "string" ? b.linea.trim() : "";
  if (!(BODEGA_LINEAS as readonly string[]).includes(linea)) {
    return { ok: false, error: "Línea de bodega inválida (fertilizante o herbicida)." };
  }
  if (!isIsoDate(b.fecha)) return { ok: false, error: "fecha debe ser YYYY-MM-DD." };
  if (!isNonEmptyString(b.proveedor)) return { ok: false, error: "proveedor es obligatorio." };
  if (!isNonEmptyString(b.producto)) return { ok: false, error: "producto es obligatorio." };
  const monto = asNumber(b.monto);
  if (monto == null || monto < 0) return { ok: false, error: "monto debe ser un número >= 0." };

  let cantidad: number | null = null;
  if (b.cantidad != null && String(b.cantidad).trim() !== "") {
    const n = asNumber(b.cantidad);
    if (n == null || n <= 0) return { ok: false, error: "cantidad debe ser mayor a 0." };
    cantidad = Math.round(n * 1000) / 1000;
  }

  const unidadRaw = asOptionalString(b.unidad) ?? "kg";
  const unidad = (BODEGA_UNIDADES as readonly string[]).includes(unidadRaw)
    ? unidadRaw
    : unidadRaw.slice(0, 12);

  return {
    ok: true,
    data: {
      linea: linea as BodegaLinea,
      fecha: b.fecha,
      proveedor: b.proveedor.trim().slice(0, 120),
      producto: b.producto.trim().slice(0, 120),
      cantidad,
      unidad,
      monto: Math.round(monto * 100) / 100,
      concepto: asOptionalString(b.concepto)?.slice(0, 255) ?? undefined,
    },
  };
}
