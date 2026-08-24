import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Moneda del sistema: colones costarricenses (CRC). */
export const SYSTEM_CURRENCY = "CRC";
export const SYSTEM_LOCALE = "es-CR";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(SYSTEM_LOCALE, {
    style: "currency",
    currency: SYSTEM_CURRENCY,
    minimumFractionDigits: 2,
  }).format(value);
}

/** Eje de gráficas y KPIs: abrevia para que no se recorten ni amontonen cifras. */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    const digits = n >= 10 ? 0 : 1;
    return `${sign}₡${n.toFixed(digits)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₡${Math.round(abs / 1_000)}k`;
  }
  return `${sign}₡${Math.round(abs)}`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat(SYSTEM_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(SYSTEM_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
