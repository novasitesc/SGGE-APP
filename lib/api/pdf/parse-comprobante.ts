import { extractPdfText, extractPdfTextAsync } from "./extract-text";
import { findClaveCR, parseClaveCR } from "./clave-cr";
import { parseCrNumber } from "./cr-number";
import { parsePlatanarFactura, type PlatanarAnimalLine } from "./parse-platanar";
import { looksLikePlatanar, normalizeSpacedPdfText } from "./normalize-spaced";
import { lookupEmisor } from "./emisores-conocidos";
import { decodeCustomPdfText } from "./decode-custom-font";

export { parseCrNumber } from "./cr-number";

export type ParsedLineItem = {
  descripcion: string;
  cantidad: number | null;
  total: number | null;
};

export type ParsedComprobante = {
  clave: string | null;
  folioFiscal: string | null;
  tipoDocumento: string | null;
  emisorNombre: string | null;
  emisorIdentificacion: string | null;
  fechaEmision: string | null;
  moneda: string;
  montoTotal: number | null;
  texto: string;
  /** Líneas de animales (Subasta Platanar / remates). */
  animales?: PlatanarAnimalLine[];
  pesoTotalKg?: number | null;
  origenParser?: "platanar" | "generico";
};

function detectMoneda(text: string): string {
  if (/\bUSD\b|\bUS\$|d[oó]lares/i.test(text)) return "USD";
  return "CRC";
}

function extractMontoTotal(text: string): number | null {
  const candidates: number[] = [];
  const MAX_MONTO = 100_000_000_000;
  const MIN_MONTO = 100; // evita basura tipo 0.00 / 33

  const push = (raw: string) => {
    const n = parseCrNumber(raw);
    if (n != null && n >= MIN_MONTO && n < MAX_MONTO) candidates.push(n);
  };

  const compact = text.replace(/\s+/g, "");
  const labeled = [
    /TOTALAPAGAR([\d,]+\.\d{2,5})/gi,
    /TOTALCOMPROBANTECRC([\d,]+\.\d{2,5})/gi,
    /TOTALCOMPROBANTE([\d,]+\.\d{2,5})/gi,
    /TOTAL\(CRC\)([\d,]+\.\d{2,5})/gi,
    /TOTALCRC([\d,]+\.\d{2,5})/gi,
    /(?<![A-Za-z])TOTAL[:=]?[¢₡$]*([\d,]+\.\d{2,5})/gi,
    /Total(?:General|Comprobante|Factura|Documento)?[:=]?[¢₡$]*([\d,]+\.\d{2,5})/gi,
    /ImporteTotal[:=]?[¢₡$]*([\d,]+\.\d{2,5})/gi,
    /MontoTotal[:=]?[¢₡$]*([\d,]+\.\d{2,5})/gi,
  ];

  for (const source of [compact, text]) {
    for (const re of labeled) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source)) !== null) push(m[1]);
    }
  }

  // Ventana tras cada "TOTAL": recoge todos los importes (evita 0.00 pegado a 33,022.00).
  const upper = compact.toUpperCase();
  let from = 0;
  while (true) {
    const idx = upper.indexOf("TOTAL", from);
    if (idx === -1) break;
    const window = compact.slice(idx, idx + 80);
    for (const m of window.matchAll(/[\d,]+\.\d{2}/g)) push(m[0]);
    from = idx + 5;
  }

  const fromLetters = extractMontoDesdeLetras(text);
  if (fromLetters != null) candidates.push(fromLetters);

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

const UNIDADES: Record<string, number> = {
  CERO: 0,
  UN: 1,
  UNA: 1,
  UNO: 1,
  DOS: 2,
  TRES: 3,
  CUATRO: 4,
  CINCO: 5,
  SEIS: 6,
  SIETE: 7,
  OCHO: 8,
  NUEVE: 9,
  DIEZ: 10,
  ONCE: 11,
  DOCE: 12,
  TRECE: 13,
  CATORCE: 14,
  QUINCE: 15,
  DIECISEIS: 16,
  DIECISIETE: 17,
  DIECIOCHO: 18,
  DIECINUEVE: 19,
  VEINTE: 20,
  VEINTIUN: 21,
  VEINTIUNO: 21,
  VEINTIDOS: 22,
  VEINTITRES: 23,
  VEINTICUATRO: 24,
  VEINTICINCO: 25,
  VEINTISEIS: 26,
  VEINTISIETE: 27,
  VEINTIOCHO: 28,
  VEINTINUEVE: 29,
  TREINTA: 30,
  CUARENTA: 40,
  CINCUENTA: 50,
  SESENTA: 60,
  SETENTA: 70,
  OCHENTA: 80,
  NOVENTA: 90,
};

const CENTENAS: Record<string, number> = {
  CIEN: 100,
  CIENTO: 100,
  DOSCIENTOS: 200,
  TRESCIENTOS: 300,
  CUATROCIENTOS: 400,
  QUINIENTOS: 500,
  SEISCIENTOS: 600,
  SETECIENTOS: 700,
  OCHOCIENTOS: 800,
  NOVECIENTOS: 900,
};

/** Interpreta "SIETE MIL…" o compactado "SIETEMILCUATROCIENTOSVEINTIUNCOLONES". */
function extractMontoDesdeLetras(text: string): number | null {
  const variants = [text, decodeCustomPdfText(text)];
  let best: number | null = null;

  for (const v of variants) {
    const upper = v
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const spaced = upper.replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
    const compact = upper.replace(/[^A-Z]/g, "");

    const candidates: string[] = [];
    const fromLabel =
      compact.match(/VALORENLETRAS([A-Z]{8,80}?)COLONES/) ??
      compact.match(/TOTALCRC([A-Z]{8,80}?)COLONES/) ??
      compact.match(/TOTAL([A-Z]{8,80}?)COLONES/);
    if (fromLabel) candidates.push(fromLabel[1]);
    // Fallback: primera aparición de un monto típico hasta COLONES
    const loose = compact.match(
      /((?:DIECINUEVE|SIETE|TRES|DIEZ|QUINCE|VEINTE|VEINTICINCO|TREINTA|CUARENTA|CINCUENTA|SESENTA|SETENTA|OCHENTA|NOVENTA|CIEN|UN|DOS|CUATRO|CINCO|SEIS|OCHO|NUEVE)[A-Z]{0,60}?)COLONES/
    );
    if (loose) candidates.push(loose[1]);
    candidates.push(spaced);

    for (const phrase of candidates) {
      const n = phrase.includes(" ")
        ? parseSpanishAmountWords(phrase)
        : parseCompactSpanishAmount(phrase);
      if (n != null && n >= 100 && n < 100_000_000) {
        if (best == null || n > best) best = n;
      }
    }
  }
  return best;
}

/** Tokeniza greedy un string sin espacios: SIETEMILCUATROCIENTOSVEINTIUN → 7421 */
function parseCompactSpanishAmount(compact: string): number | null {
  const vocab = [
    ...Object.keys(CENTENAS),
    ...Object.keys(UNIDADES),
    "MILLONES",
    "MILLON",
    "MIL",
  ].sort((a, b) => b.length - a.length);

  const tokens: string[] = [];
  let i = 0;
  const s = compact.replace(/COLONES.*$/, "").replace(/^VALORENLETRAS/, "").replace(/^TOTALCRC?/, "");
  while (i < s.length) {
    let hit: string | null = null;
    for (const w of vocab) {
      if (s.startsWith(w, i)) {
        hit = w;
        break;
      }
    }
    if (!hit) {
      // No match: si ya hay tokens, terminar; si no, avanzar 1
      if (tokens.length > 0) break;
      i += 1;
      continue;
    }
    tokens.push(hit);
    i += hit.length;
  }
  if (tokens.length === 0) return null;
  return parseSpanishAmountWords(tokens.join(" "));
}

function parseSpanishAmountWords(phrase: string): number | null {
  const stop = new Set([
    "COLON",
    "COLONES",
    "EXACTO",
    "EXACTOS",
    "CON",
    "Y",
    "DE",
    "CRC",
    "CENTAVO",
    "CENTAVOS",
  ]);
  const tokens = phrase
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !stop.has(w));

  let total = 0;
  let current = 0;
  let sawNumber = false;

  for (const raw of tokens) {
    const w = raw === "VEINTIUN" ? "VEINTIUNO" : raw;
    if (w === "MILLON" || w === "MILLONES") {
      current = (current || 1) * 1_000_000;
      total += current;
      current = 0;
      sawNumber = true;
      continue;
    }
    if (w === "MIL") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      sawNumber = true;
      continue;
    }
    if (CENTENAS[w] != null) {
      current += CENTENAS[w];
      sawNumber = true;
      continue;
    }
    if (UNIDADES[w] != null) {
      current += UNIDADES[w];
      sawNumber = true;
      continue;
    }
    if (sawNumber && total + current >= 100) break;
  }

  const sum = total + current;
  return sawNumber && sum > 0 ? sum : null;
}

function extractEmisorNombre(text: string): string | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);
  for (const line of lines.slice(0, 6)) {
    if (/factura|comprobante|clave|c[eé]dula|tel[eé]fono|direcci[oó]n|fecha/i.test(line)) {
      continue;
    }
    if (/^[\d\s.,:/-]+$/.test(line)) continue;
    if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(line)) {
      return line.slice(0, 200);
    }
  }
  return lines[0]?.slice(0, 200) ?? null;
}

function extractFolioFiscal(text: string): string | null {
  const m =
    text.match(/(?:Factura\s*(?:Electr[oó]nica)?|Comprobante|Consecutivo|Fact\.?)\s*(?:N[°ºo]\.?|#|No\.?)?\s*:?\s*(\d{15,25})/i) ??
    text.match(/\b(\d{20})\b/);
  return m ? m[1] : null;
}

/** Parsea un comprobante a partir del PDF y el nombre de archivo. */
export function parseComprobante(buffer: Buffer, fileName: string): ParsedComprobante {
  return parseComprobanteFromText(extractPdfText(buffer), fileName);
}

/** Igual que parseComprobante, pero con unpdf si la fuente CID sale ilegible. */
export async function parseComprobanteAsync(
  buffer: Buffer,
  fileName: string
): Promise<ParsedComprobante> {
  const texto = await extractPdfTextAsync(buffer);
  return parseComprobanteFromText(texto, fileName);
}

function parseComprobanteFromText(texto: string, fileName: string): ParsedComprobante {

  // Subasta Platanar: texto con letras espaciadas + líneas de animales.
  const platanar = parsePlatanarFactura(texto, fileName);
  if (platanar.isPlatanar && platanar.animales.length > 0) {
    return {
      clave: null,
      folioFiscal: platanar.folio,
      tipoDocumento: "factura_compra",
      emisorNombre: platanar.emisorNombre,
      emisorIdentificacion: platanar.emisorIdentificacion,
      fechaEmision: platanar.fechaEmision,
      moneda: "CRC",
      montoTotal: platanar.total ?? platanar.subtotal,
      texto: platanar.textoNormalizado.slice(0, 20000),
      animales: platanar.animales,
      pesoTotalKg: platanar.pesoTotalKg,
      origenParser: "platanar",
    };
  }

  // Si el nombre/contenido sugiere Platanar pero no se extrajeron líneas,
  // igual marcamos emisor/fecha cuando se pueda.
  if (looksLikePlatanar(fileName) || platanar.isPlatanar) {
    const clave = findClaveCR(texto) ?? findClaveCR(fileName);
    const claveInfo = clave ? parseClaveCR(clave) : null;
    return {
      clave: claveInfo?.clave ?? clave ?? null,
      folioFiscal: platanar.folio ?? claveInfo?.consecutivo ?? extractFolioFiscal(texto),
      tipoDocumento: "factura_compra",
      emisorNombre: platanar.emisorNombre,
      emisorIdentificacion: platanar.emisorIdentificacion,
      fechaEmision: platanar.fechaEmision ?? claveInfo?.fechaEmision ?? null,
      moneda: "CRC",
      montoTotal: platanar.total ?? platanar.subtotal ?? extractMontoTotal(platanar.textoNormalizado),
      texto: platanar.textoNormalizado.slice(0, 20000),
      animales: [],
      pesoTotalKg: platanar.pesoTotalKg,
      origenParser: "platanar",
    };
  }

  const clave = findClaveCR(texto) ?? findClaveCR(fileName);
  const claveInfo = clave ? parseClaveCR(clave) : null;
  const textoNorm = normalizeSpacedPdfText(texto);
  const textoDecoded = decodeCustomPdfText(texto);
  const emisorId = claveInfo?.emisorIdentificacion ?? null;
  const known = lookupEmisor(emisorId);
  const monto =
    extractMontoTotal(textoNorm) ??
    extractMontoTotal(texto) ??
    extractMontoTotal(textoDecoded);

  // Preferir texto decodificado cuando el original viene de fuente custom ilegible.
  const textoUsable =
    (monto != null && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{8,}/.test(textoDecoded) && !/[A-Za-zÁÉÍÓÚÑáéíóúñ]{8,}/.test(textoNorm)
      ? textoDecoded
      : textoNorm || texto) || textoDecoded;

  return {
    clave: claveInfo?.clave ?? clave ?? null,
    folioFiscal: claveInfo?.consecutivo ?? extractFolioFiscal(textoUsable) ?? extractFolioFiscal(texto),
    tipoDocumento: claveInfo?.tipoDocumento ?? null,
    emisorNombre: known?.nombre ?? extractEmisorNombre(textoUsable) ?? extractEmisorNombre(texto),
    emisorIdentificacion: emisorId,
    fechaEmision: claveInfo?.fechaEmision ?? null,
    moneda: detectMoneda(texto),
    montoTotal: monto,
    texto: textoUsable.slice(0, 20000),
    origenParser: "generico",
  };
}
