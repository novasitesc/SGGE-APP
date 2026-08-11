/** Persistencia del lote operativo activo (ciclo de engorda). */

export const ACTIVE_LOTE_STORAGE_KEY = "sgge.activeLoteId";

export type LoteOption = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
};

export function readStoredLoteId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(ACTIVE_LOTE_STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function writeStoredLoteId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!id) window.localStorage.removeItem(ACTIVE_LOTE_STORAGE_KEY);
    else window.localStorage.setItem(ACTIVE_LOTE_STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefiere el guardado; si no existe, el primer lote abierto; si no, el primero. */
export function pickDefaultLoteId(
  lotes: LoteOption[],
  preferredId?: string | null
): string | null {
  if (lotes.length === 0) return null;
  if (preferredId && lotes.some((l) => l.id === preferredId)) return preferredId;
  const abierto = lotes.find((l) => l.estado === "abierto");
  return abierto?.id ?? lotes[0]?.id ?? null;
}

export function loteLabel(lote: LoteOption | null | undefined): string {
  if (!lote) return "Sin lote";
  if (lote.nombre && lote.nombre !== lote.codigo) {
    return `${lote.codigo} · ${lote.nombre}`;
  }
  return lote.codigo || lote.nombre || "Lote";
}
