import type { BodegaLinea } from "../types/bodega.types";

/** Herbicidas: términos específicos (antes que fertilizante). */
const HERB_KEYWORDS = [
  "herbicida",
  "herbicidas",
  "glifosato",
  "glyphosate",
  "roundup",
  "paraquat",
  "gramoxone",
  "atrazina",
  "diuron",
  "diurón",
  "2,4-d",
  "24-d",
  "2.4-d",
  "matamaleza",
  "mata maleza",
  "control de maleza",
  "control de malezas",
];

/**
 * Abono/fertilizante. No usar "abono" solo: en CR también es un pago parcial.
 */
const FERT_KEYWORDS = [
  "fertilizante",
  "fertilizantes",
  "abono organico",
  "abono orgánico",
  "abono foliar",
  "abono completo",
  "abono quimico",
  "abono químico",
  "abonos y fertilizantes",
  "urea",
  "npk",
  "10-30-10",
  "12-24-12",
  "15-15-15",
  "18-46-0",
  "fosfato diamonico",
  "fosfato diamónico",
  "fosfato de amonio",
  "muriato de potasio",
  "nitrato de amonio",
  "cal agricola",
  "cal agrícola",
  "cal dolomita",
  "gallinaza",
];

const PRODUCTO_HINTS: Array<{ match: string; nombre: string; linea: BodegaLinea }> = [
  { match: "glifosato", nombre: "Glifosato", linea: "herbicida" },
  { match: "roundup", nombre: "Roundup", linea: "herbicida" },
  { match: "paraquat", nombre: "Paraquat", linea: "herbicida" },
  { match: "gramoxone", nombre: "Gramoxone", linea: "herbicida" },
  { match: "atrazina", nombre: "Atrazina", linea: "herbicida" },
  { match: "urea", nombre: "Urea", linea: "fertilizante" },
  { match: "10-30-10", nombre: "Fertilizante 10-30-10", linea: "fertilizante" },
  { match: "12-24-12", nombre: "Fertilizante 12-24-12", linea: "fertilizante" },
  { match: "15-15-15", nombre: "Fertilizante 15-15-15", linea: "fertilizante" },
  { match: "18-46-0", nombre: "Fosfato diamónico 18-46-0", linea: "fertilizante" },
  { match: "muriato", nombre: "Muriato de potasio", linea: "fertilizante" },
  { match: "gallinaza", nombre: "Gallinaza", linea: "fertilizante" },
  { match: "abono foliar", nombre: "Abono foliar", linea: "fertilizante" },
  { match: "abono organico", nombre: "Abono orgánico", linea: "fertilizante" },
  { match: "abono orgánico", nombre: "Abono orgánico", linea: "fertilizante" },
];

export function inferLineaBodega(texto: string): BodegaLinea | null {
  const t = texto.toLowerCase();
  if (HERB_KEYWORDS.some((k) => t.includes(k))) return "herbicida";
  if (FERT_KEYWORDS.some((k) => t.includes(k))) return "fertilizante";
  return null;
}

export function inferProductoBodega(
  texto: string,
  fallback: string
): string {
  const t = texto.toLowerCase();
  const hit = PRODUCTO_HINTS.find((p) => t.includes(p.match));
  if (hit) return hit.nombre;
  const trimmed = fallback.trim();
  return trimmed.slice(0, 120) || "Insumo de bodega";
}

export { HERB_KEYWORDS, FERT_KEYWORDS };
