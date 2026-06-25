/** Normaliza peso en kg a 2 decimales (evita 429.999999 → 430). */
export function normalizeWeightKg(value: number | string): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

export function parseWeightField(value: string): number {
  return normalizeWeightKg(value);
}
