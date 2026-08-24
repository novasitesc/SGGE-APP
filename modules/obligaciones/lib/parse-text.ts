import type {
  TipoAporteCcss,
  TipoPoliza,
  TipoServicioPublico,
} from "../types/obligaciones.types";

export function extractNumeroPoliza(texto: string): string | null {
  const m = texto.match(/p[oó]liza\s*#?\s*(\d{4,})/i);
  return m?.[1] ?? null;
}

export function inferTipoPoliza(texto: string): TipoPoliza {
  const t = texto.toLowerCase();
  if (t.includes("riesgos del trabajo") || t.includes("riesgo del trabajo")) {
    return "riesgos_trabajo";
  }
  if (t.includes("vehículo") || t.includes("vehiculo") || t.includes("automotor")) {
    return "vehiculo";
  }
  if (t.includes("ganadero") || t.includes("semoviente") || t.includes("hacienda")) {
    return "ganadero";
  }
  if (t.includes("incendio") || t.includes("fuego")) return "incendio";
  return "otro";
}

export function extractPeriodoCcss(texto: string, fecha: string): string {
  const m = texto.match(/(?:per[ií]odo|periodo)\s*[:\s]*(\d{6})/i)
    ?? texto.match(/\b(20\d{2}(?:0[1-9]|1[0-2]))\b/);
  if (m?.[1]) return m[1];
  const ymd = fecha.slice(0, 7).replace("-", "");
  return /^\d{6}$/.test(ymd) ? ymd : fecha.slice(0, 4) + fecha.slice(5, 7);
}

export function inferTipoServicioPublico(
  texto: string,
  emisorNombre: string | null
): TipoServicioPublico {
  const t = `${texto} ${emisorNombre ?? ""}`.toLowerCase();
  if (
    t.includes("electricidad") ||
    t.includes("ice") ||
    t.includes("cnel") ||
    t.includes("kwh") ||
    t.includes("kilovatio")
  ) {
    return "electricidad";
  }
  if (
    t.includes("acueducto") ||
    t.includes("alcantarillado") ||
    t.includes("aya") ||
    t.includes("agua potable")
  ) {
    return "agua";
  }
  if (t.includes("kolbi") || t.includes("telefon") || t.includes("telefón")) {
    return "telecomunicaciones";
  }
  if (t.includes("internet") || t.includes("fibra")) return "internet";
  return "otro";
}

export function formatPeriodoLabel(periodo: string): string {
  if (!/^\d{6}$/.test(periodo)) return periodo;
  return `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;
}
