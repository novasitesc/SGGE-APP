import { inflateSync, inflateRawSync } from "node:zlib";

/**
 * Extractor de texto ligero para PDFs, sin dependencias externas.
 *
 * Estrategia:
 *  1. Descomprime los streams FlateDecode con zlib.
 *  2. Recolecta cadenas de los operadores de texto: `( ... ) Tj/TJ` y `< hex >`.
 *  3. Normaliza espacios.
 *
 * Es "best-effort": PDFs con fuentes subset/custom pueden salir ilegibles.
 * Usar `extractPdfTextAsync` (unpdf/PDF.js) cuando el resultado sea basura CID.
 */
export function extractPdfText(buffer: Buffer): string {
  const texts: string[] = [];
  const streams = extractStreams(buffer);

  for (const stream of streams) {
    const decoded = tryInflate(stream);
    if (!decoded) continue;
    collectTextOperators(decoded, texts);
  }

  // Fallback: si no se obtuvo casi nada, intenta cadenas ASCII imprimibles.
  let joined = texts.join(" ");
  if (joined.replace(/\s/g, "").length < 20) {
    joined = extractPrintableRuns(buffer);
  }

  return sanitizeText(
    joined.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim()
  );
}

/** PDFs tipo AVIN: glifos CID → dígitos espaciados sin palabras reales. */
export function looksLikeCidGarbage(text: string): boolean {
  if (/TOTAL\s*COMPROBANTE|FACTURA\s*ELECTR[OÓ]NICA|SUBASTA\s*PLATANAR|VALOR\s*EN\s*LETRAS/i.test(text)) {
    return false;
  }
  const realWords = text.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}/g) ?? [];
  if (realWords.length >= 12) return false;

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 15) return realWords.length < 3;

  const short = tokens.filter((t) => t.length <= 2).length;
  return short / tokens.length > 0.55 || realWords.length < 5;
}

/**
 * Extracción robusta: intenta unpdf (PDF.js) si el extractor ligero falla
 * (facturas AVIN, etc. con fuentes CID).
 */
export async function extractPdfTextAsync(buffer: Buffer): Promise<string> {
  const light = extractPdfText(buffer);
  if (!looksLikeCidGarbage(light)) return light;

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = typeof text === "string" ? text : text.join("\n");
    const cleaned = sanitizeText(
      joined.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim()
    );
    if (cleaned.replace(/\s/g, "").length > light.replace(/\s/g, "").length * 0.5 && !looksLikeCidGarbage(cleaned)) {
      return cleaned;
    }
    // Preferir el que tenga más palabras reales
    const lightWords = (light.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}/g) ?? []).length;
    const cleanWords = (cleaned.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}/g) ?? []).length;
    return cleanWords >= lightWords ? cleaned : light;
  } catch {
    return light;
  }
}

/**
 * Elimina NUL (\u0000) y caracteres de control que PostgreSQL (text/jsonb)
 * rechaza con "unsupported Unicode escape sequence". Conserva \t \n \r.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/\u0000/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Sustitutos/no-caracteres Unicode inválidos para UTF-8 en Postgres.
    .replace(/[\uD800-\uDFFF\uFFFE\uFFFF]/g, "");
}

function extractStreams(buffer: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  const marker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");
  let idx = 0;

  while (idx < buffer.length) {
    const start = buffer.indexOf(marker, idx);
    if (start === -1) break;
    let dataStart = start + marker.length;
    // Saltar el EOL posterior a "stream" (\r\n o \n).
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const end = buffer.indexOf(endMarker, dataStart);
    if (end === -1) break;

    let dataEnd = end;
    // Recortar EOL previo a "endstream".
    if (buffer[dataEnd - 1] === 0x0a) dataEnd--;
    if (buffer[dataEnd - 1] === 0x0d) dataEnd--;

    streams.push(buffer.subarray(dataStart, dataEnd));
    idx = end + endMarker.length;
  }

  return streams;
}

function tryInflate(data: Buffer): Buffer | null {
  const candidates = [data, data.subarray(0, data.length)];
  for (const candidate of candidates) {
    try {
      return inflateSync(candidate);
    } catch {
      // zlib con cabecera falló; probar raw deflate.
    }
    try {
      return inflateRawSync(candidate);
    } catch {
      // no era un stream Flate.
    }
  }
  return null;
}

function collectTextOperators(content: Buffer, out: string[]): void {
  const text = content.toString("latin1");

  // Cadenas literales entre paréntesis: (texto)Tj  o  [(a)(b)]TJ
  const literalRe = /\((?:\\.|[^\\()])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(text)) !== null) {
    const raw = m[0].slice(1, -1);
    const decoded = decodeLiteral(raw);
    if (decoded.trim()) out.push(decoded);
  }

  // Cadenas hexadecimales: <48656C6C6F> Tj
  const hexRe = /<([0-9A-Fa-f\s]+)>/g;
  while ((m = hexRe.exec(text)) !== null) {
    const hex = m[1].replace(/\s+/g, "");
    if (hex.length < 2 || hex.length % 2 !== 0) continue;
    let s = "";
    for (let i = 0; i < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    if (/[A-Za-z0-9]/.test(s)) out.push(s);
  }
}

function decodeLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "")
    .replace(/\\f/g, "")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8) & 0xff)
    );
}

function extractPrintableRuns(buffer: Buffer): string {
  const text = buffer.toString("latin1");
  const runs = text.match(/[\x20-\x7E\xC0-\xFF]{5,}/g) ?? [];
  return runs.slice(0, 400).join(" ");
}
