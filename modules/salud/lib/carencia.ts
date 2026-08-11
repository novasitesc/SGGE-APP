/** Utilidades de periodo de carencia / retiro sanitario. */

export function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return dateIso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type CarenciaComputed = {
  diasCarencia: number;
  fechaFinCarencia: string | null;
  listoTraslado: boolean;
};

/**
 * fecha_fin_carencia = fecha de aplicación + días del manual de uso.
 * listo_traslado cuando hoy >= fecha_fin_carencia (o sin carencia).
 */
export function computeCarencia(
  fechaAplicacion: string,
  diasCarencia: number,
  asOf: string = todayIso()
): CarenciaComputed {
  const dias = Math.max(0, Math.floor(Number(diasCarencia) || 0));
  if (dias <= 0) {
    return {
      diasCarencia: 0,
      fechaFinCarencia: null,
      listoTraslado: true,
    };
  }
  const fechaFinCarencia = addDaysIso(fechaAplicacion, dias);
  return {
    diasCarencia: dias,
    fechaFinCarencia,
    listoTraslado: fechaFinCarencia <= asOf,
  };
}

/** Ventana de aviso previo (días antes del fin de carencia). */
export const CARENCIA_AVISO_DIAS = 3;
