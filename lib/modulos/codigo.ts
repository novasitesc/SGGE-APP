/** Prefijos de código únicos por tipo de módulo/corral. */
export const MODULE_TYPE_PREFIXES: Record<string, string> = {
  engorda: "M",
  leche: "L",
  cría: "CR",
  recría: "RC",
  cuarentena: "CQ",
  enfermeria: "ENF",
};

export function prefixForModuleType(type: string): string {
  return MODULE_TYPE_PREFIXES[type] ?? "X";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extrae el número de secuencia de un código dado su prefijo.
 * Códigos legacy sin número (p. ej. CQ, ENF) cuentan como 1.
 */
export function parseCodigoSequence(
  codigo: string,
  prefix: string
): number | null {
  const upper = codigo.trim().toUpperCase();
  const p = prefix.toUpperCase();
  if (!upper.startsWith(p)) return null;
  if (upper === p) return 1;
  const match = upper.match(new RegExp(`^${escapeRegExp(p)}(\\d+)$`));
  return match ? Number(match[1]) : null;
}

/**
 * Menor código libre para el tipo (rellena huecos).
 * Solo debe recibir códigos de corrales activos.
 * `prefixOverride` permite usar el prefijo del catálogo tipos_corral.
 */
export function nextCodigoFromList(
  type: string,
  existingCodigos: string[],
  prefixOverride?: string
): string {
  const prefix = (prefixOverride ?? prefixForModuleType(type)).toUpperCase();
  const used = new Set<number>();
  for (const codigo of existingCodigos) {
    const n = parseCodigoSequence(codigo, prefix);
    if (n != null) used.add(n);
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${n}`;
}
