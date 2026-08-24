export const BODEGA_LINEAS = ["fertilizante", "herbicida"] as const;
export type BodegaLinea = (typeof BODEGA_LINEAS)[number];

export const BODEGA_CODIGOS = ["FERT", "HERB"] as const;
export type BodegaCodigo = (typeof BODEGA_CODIGOS)[number];

export const LINEA_POR_CODIGO: Record<BodegaCodigo, BodegaLinea> = {
  FERT: "fertilizante",
  HERB: "herbicida",
};

export const CODIGO_POR_LINEA: Record<BodegaLinea, BodegaCodigo> = {
  fertilizante: "FERT",
  herbicida: "HERB",
};

export const BODEGA_LINEA_LABEL: Record<BodegaLinea, string> = {
  fertilizante: "Abono y fertilizantes",
  herbicida: "Herbicidas",
};

export const BODEGA_UNIDADES = ["kg", "L", "saco", "und"] as const;
export type BodegaUnidad = (typeof BODEGA_UNIDADES)[number];

export type OrigenBodega = "manual" | "comprobante";

export type BodegaCompra = {
  id: string;
  linea: BodegaLinea;
  fecha: string;
  proveedor: string;
  producto: string;
  cantidad: number | null;
  unidad: string;
  monto: number;
  concepto: string;
  gastoId: string | null;
  comprobanteId: string | null;
  origen: OrigenBodega;
  fileName?: string | null;
};

export type CreateBodegaCompraInput = {
  linea: BodegaLinea;
  fecha: string;
  proveedor: string;
  producto: string;
  cantidad?: number | null;
  unidad?: string;
  monto: number;
  concepto?: string;
};

export function esCodigoBodega(code: string | null | undefined): code is BodegaCodigo {
  if (!code) return false;
  return (BODEGA_CODIGOS as readonly string[]).includes(code.toUpperCase());
}

export function lineaDesdeCodigo(code: string): BodegaLinea {
  const upper = code.toUpperCase();
  if (upper === "HERB") return "herbicida";
  return "fertilizante";
}
