/**
 * Convierte un número en formato CR a Number.
 * Soporta "33,758.48" (coma miles / punto decimal) y "32 650,00" (espacio miles / coma decimal).
 */
export function parseCrNumber(raw: string): number | null {
  let s = raw.trim().replace(/[₡¢$\s]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
