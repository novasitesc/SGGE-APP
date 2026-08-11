/**
 * Unidades de medida del dominio (alimentación + salud).
 * No todo es kg: vet suele ir en ml / dosis; ferretería en und.
 */

export type FamiliaUnidad = "masa" | "volumen" | "conteo" | "dosis" | "desconocida";

/** Normaliza etiquetas típicas del PDF / catálogo. */
export function normalizarUnidad(raw: string | null | undefined): string {
  const u = (raw ?? "").trim().toLowerCase();
  if (!u) return "";
  if (/^(kg|kgs|kilo|kilos)$/.test(u)) return "kg";
  if (/^(g|gr|gramo|gramos)$/.test(u)) return "g";
  if (/^(saco|sacos)$/.test(u)) return "saco";
  if (/^(ml|cc|cm3)$/.test(u)) return "ml";
  if (/^(l|lt|litro|litros|gl|galon|galón)$/.test(u)) return "l";
  if (/^(und|u|unidad|unidades|pza|pieza)$/.test(u)) return "und";
  if (/^(dosis|ds|implante)$/.test(u)) return "dosis";
  if (u === "compra") return "compra";
  return u;
}

export function familiaUnidad(raw: string | null | undefined): FamiliaUnidad {
  const u = normalizarUnidad(raw);
  if (!u || u === "compra") return "desconocida";
  if (u === "kg" || u === "g" || u === "saco") return "masa";
  if (u === "ml" || u === "l") return "volumen";
  if (u === "dosis") return "dosis";
  if (u === "und") return "conteo";
  return "desconocida";
}

export function esUnidadMasa(raw: string | null | undefined): boolean {
  return familiaUnidad(raw) === "masa";
}

/** Etiqueta corta para UI. */
export function labelUnidad(raw: string | null | undefined): string {
  const u = normalizarUnidad(raw);
  switch (u) {
    case "kg":
      return "kg";
    case "g":
      return "g";
    case "saco":
      return "saco(s)";
    case "ml":
      return "ml";
    case "l":
      return "L";
    case "und":
      return "und";
    case "dosis":
      return "dosis";
    case "compra":
      return "compra";
    default:
      return u || "und";
  }
}

/**
 * Infiera unidad desde nombre de línea PDF (vet / alimento).
 * Ej: "BAYTRIL MAX 250CC" → ml; "REVALOR H 20" → dosis; "MELAZA KG" → kg.
 */
export function unidadDesdeNombreProducto(nombre: string): string {
  const n = nombre.toUpperCase();
  if (/\bKG\b|KILO/.test(n) && !/\b(CC|ML)\b/.test(n)) return "kg";
  if (/\d+(?:[.,]\d+)?\s*(CC|ML)\b/.test(n) || /\b(CC|ML)\b/.test(n)) return "ml";
  if (/\d+(?:[.,]\d+)?\s*L\b/.test(n) || /\bGL\b/.test(n)) return "ml";
  if (/REVALOR|IMPLANT|\bDS\b|DOSIS/.test(n)) return "dosis";
  if (/SACOS?\b/.test(n)) return "saco";
  return "und";
}
