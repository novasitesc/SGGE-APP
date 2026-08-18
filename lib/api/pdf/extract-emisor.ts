import { CEDULA_GRANJA, EMISORES_CONOCIDOS, lookupEmisor, type EmisorConocido } from "./emisores-conocidos";

const NOMBRES_CATALOGO_DEBILES = new Set([
  "proveedor",
  "servicios de contabilidad",
  "materiales / ferretería",
  "materiales / ferreteria",
  "combustible / diésel",
  "combustible / diesel",
]);

const JUNK_LINE =
  /^(factura(\s+electr[oó]nica)?|tiquete(\s+electr[oó]nico)?|comprobante(\s+electr[oó]nico)?|nota\s+de\s+(cr[eé]dito|d[eé]bito)|clave(\s+num[eé]rica)?|consecutivo|ministerio\s+de\s+hacienda|hacienda|p[aá]gina|original|copia|receptor|cliente|adquirente|destinatario|identificaci[oó]n|c[eé]dula(\s+jur[ií]dica)?|tipo\s+de\s+identificaci[oó]n|tel[eé]fono|fax|correo|e-?mail|direcci[oó]n|provincia|cant[oó]n|distrito|otras\s+se[nñ]as|c[oó]digo\s+de\s+actividad|actividad\s+econ[oó]mica|condici[oó]n\s+de\s+venta|medio\s+de\s+pago|detalle|desglose|impuesto|exento|gravado|valor\s+en\s+letras|total(\s+comprobante)?|colones|usd|crc|fecha(\s+de\s+emisi[oó]n)?|vencimiento|sucursal|terminal|interno|referencia)$/i;

const JUNK_CONTAINS =
  /@|www\.|http|whatsapp|p[aá]gina\s+\d|clave\s+num[eé]rica|c[oó]digo\s+de\s+seguridad|tipo\s+de\s+cambio|tipo\s+cambio|ministerio\s+de\s+hacienda/i;

const JUNK_PREFIX =
  /^(factura|tiquete|comprobante|clave|consecutivo|tel[eé]fono|fax|correo|e-?mail|direcci[oó]n|fecha|identificaci[oó]n|c[eé]dula|receptor|cliente)\b/i;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCandidate(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s:.\-–—]+/, "")
    .replace(/[\s:.\-–—]+$/, "")
    .slice(0, 160)
    .trim();
}

/** Número de factura corto (últimos 10 del consecutivo CR, sin ceros). */
export function folioCorto(
  folioFiscal: string | null | undefined,
  consecutivo: string | null | undefined
): string | null {
  const raw = consecutivo || folioFiscal || "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = (digits.length >= 10 ? digits.slice(-10) : digits).replace(/^0+/, "");
  return n || null;
}

export function etiquetaFactura(folio: string): string {
  return `Factura ${folio}`;
}

export function isNombreCatalogoUtil(nombre: string): boolean {
  return !NOMBRES_CATALOGO_DEBILES.has(nombre.trim().toLowerCase());
}

export function isValidEmisorNombre(name: string | null | undefined): boolean {
  if (!name) return false;
  const s = cleanCandidate(name);
  if (s.length < 5 || s.length > 140) return false;
  if (/^Factura\s+\d{1,20}$/i.test(s)) return true;
  if (JUNK_LINE.test(s)) return false;
  if (JUNK_CONTAINS.test(s)) return false;
  if (JUNK_PREFIX.test(s)) return false;
  if (/^[\d\s.,:/-]+$/.test(s)) return false;
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length < 4) return false;
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits / s.length > 0.35) return false;
  // Basura CID / letras sueltas: "A B C D E"
  const singles = s.split(" ").filter((w) => w.length === 1).length;
  const words = s.split(" ").filter(Boolean);
  if (words.length >= 4 && singles / words.length > 0.5) return false;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(s)) return false;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return false;
  return true;
}

function looksLikeCompanyOrPerson(name: string): boolean {
  if (
    /\b(S\.?\s*A\.?|S\.?\s*R\.?\s*L\.?|SRL|LIMITADA|SOCIEDAD|COOPERATIVA|INSTITUTO|CAJA|MINISTERIO)\b/i.test(
      name
    )
  ) {
    return true;
  }
  const words = name.split(/\s+/).filter((w) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(w));
  return words.length >= 2;
}

function extractLabeledNombre(section: string): string | null {
  const patterns = [
    /(?:nombre(?:\s+completo)?(?:\s+del)?\s+emisor)\s*[:.\-]?\s*(.+)/i,
    /(?:raz[oó]n\s+social)\s*[:.\-]?\s*(.+)/i,
    /(?:nombre\s+comercial)\s*[:.\-]?\s*(.+)/i,
    /(?:contribuyente\s+emisor)\s*[:.\-]?\s*(.+)/i,
    /(?:^|\n)\s*nombre\s*[:.\-]\s*(.+)/i,
    /(?:emisor)\s*[:.\-]\s*(.+)/i,
  ];
  for (const re of patterns) {
    const m = section.match(re);
    if (!m?.[1]) continue;
    const line = cleanCandidate(m[1].split(/\n/)[0] ?? "");
    if (isValidEmisorNombre(line) && looksLikeCompanyOrPerson(line)) return line;
    if (isValidEmisorNombre(line) && line.length >= 8) return line;
  }
  return null;
}

function emisorSection(text: string): string {
  const start = text.search(/\bEmisor(?:es)?\b/i);
  if (start < 0) return text.slice(0, 1200);
  const rest = text.slice(start);
  const end = rest.search(
    /\b(Receptor|Cliente|Adquirente|Destinatario|Detalle(?:\s+de)?(?:\s+mercanc)|L[ií]neas?\s+de\s+detalle)\b/i
  );
  return (end > 20 ? rest.slice(0, end) : rest.slice(0, 900)).trim();
}

function scanCompanyLines(text: string): string | null {
  const lines = text
    .split(/\n+/)
    .map((l) => cleanCandidate(l))
    .filter((l) => l.length >= 5);
  const scored: { name: string; score: number }[] = [];
  for (const line of lines.slice(0, 25)) {
    if (!isValidEmisorNombre(line)) continue;
    if (JUNK_LINE.test(line)) continue;
    let score = 0;
    if (
      /\b(S\.?\s*A\.?|S\.?\s*R\.?\s*L\.?|SRL|R\.?\s*L\.?|LIMITADA|COOPERATIVA|INSTITUTO)\b/i.test(
        line
      )
    ) {
      score += 8;
    }
    if (looksLikeCompanyOrPerson(line)) score += 3;
    if (line.length >= 12 && line.length <= 80) score += 2;
    if (score >= 3) scored.push({ name: line, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.name ?? null;
}

function lookupCatalogoEnTexto(text: string): EmisorConocido | null {
  const compact = text.replace(/\D/g, "");
  const folded = fold(text);
  const seen = new Set<string>();

  for (const [id, info] of Object.entries(EMISORES_CONOCIDOS)) {
    const raw = id.replace(/^0+/, "") || id;
    if (raw === CEDULA_GRANJA) continue;
    if (raw.length >= 9 && compact.includes(raw) && isNombreCatalogoUtil(info.nombre)) {
      return info;
    }
  }

  for (const [id, info] of Object.entries(EMISORES_CONOCIDOS)) {
    const raw = id.replace(/^0+/, "") || id;
    if (raw === CEDULA_GRANJA) continue;
    if (!isNombreCatalogoUtil(info.nombre)) continue;
    const key = fold(info.nombre);
    if (key.length < 16 || seen.has(key)) continue;
    seen.add(key);
    if (folded.includes(key)) return info;
    // Nombre corto del paréntesis: "INS", "AyA", "ICE"
    const alias = info.nombre.match(/\(([^)]+)\)/)?.[1];
    if (alias && alias.length >= 3) {
      const token = ` ${fold(alias)} `;
      if (` ${folded} `.includes(token) && /INS|AYA|ICE|CCSS/i.test(alias)) {
        return info;
      }
    }
  }
  return null;
}

/**
 * Resuelve un nombre de emisor usable en revisión.
 * Prioridad: catálogo por cédula → catálogo en el texto → etiquetas del PDF →
 * razón social → número de factura (nunca basura).
 */
export function resolveEmisorNombre(input: {
  texto: string;
  emisorId?: string | null;
  known?: EmisorConocido | null;
  folioFiscal?: string | null;
  consecutivo?: string | null;
}): string {
  const known = input.known ?? lookupEmisor(input.emisorId);
  if (known && isNombreCatalogoUtil(known.nombre)) return known.nombre;

  const fromCatalogText = lookupCatalogoEnTexto(input.texto);
  if (fromCatalogText && isNombreCatalogoUtil(fromCatalogText.nombre)) {
    return fromCatalogText.nombre;
  }

  const section = emisorSection(input.texto);
  const labeled = extractLabeledNombre(section) ?? extractLabeledNombre(input.texto);
  if (labeled) return labeled;

  const scanned = scanCompanyLines(section) ?? scanCompanyLines(input.texto);
  if (scanned) return scanned;

  if (known?.nombre) return known.nombre;

  const folio = folioCorto(input.folioFiscal, input.consecutivo);
  if (folio) return etiquetaFactura(folio);

  if (input.emisorId) return `Cédula ${input.emisorId}`;
  return "Emisor no identificado";
}

/** Cédula de un emisor conocido en el texto. Omite la cédula de la granja (suele ser el receptor). */
export function lookupEmisorIdEnTexto(text: string): string | null {
  const compact = text.replace(/\D/g, "");
  for (const id of Object.keys(EMISORES_CONOCIDOS)) {
    const raw = id.replace(/^0+/, "") || id;
    if (raw === CEDULA_GRANJA) continue;
    if (raw.length >= 9 && compact.includes(raw)) return raw;
  }
  return null;
}
