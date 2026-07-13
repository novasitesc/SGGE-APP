/**
 * Normaliza texto de PDFs donde cada glifo va separado por espacios
 * (p. ej. facturas de Subasta Platanar exportadas con bioPDF / Ghostscript).
 *
 *   "T O RE T E N E G RO"  →  "TORETE NEGRO"
 *   "3 4 6 . 0 0"          →  "346.00"
 *   "1 , 4 3 0 . 0 0"      →  "1,430.00"
 */
export function normalizeSpacedPdfText(text: string): string {
  // Limitar tamaño: el colapso carácter-a-carácter es O(n) por pasada.
  let s = text.length > 200_000 ? text.slice(0, 200_000) : text;

  // Colapsar espacios entre alfanuméricos (incluye acentuados).
  // Varias pasadas: "A B C" → "AB C" → "ABC".
  const char = "[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]";
  const pair = new RegExp(`(${char})\\s+(${char})`, "g");
  let prev = "";
  let guard = 0;
  while (prev !== s && guard < 80) {
    prev = s;
    s = s.replace(pair, "$1$2");
    guard += 1;
  }

  // Espacios alrededor de . y , en números: "346 . 00" → "346.00"
  s = s.replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3");
  // Guiones de cédula: "3 1 0 1 0 2 9 9 9 3" ya colapsó; "4 - 0 1 5 3" → "4-0153"
  s = s.replace(/(\d)\s*-\s*(\d)/g, "$1-$2");

  return s.replace(/[ \t]{2,}/g, " ").trim();
}

/** Detecta si el texto (o nombre) parece una factura de Subasta Platanar. */
export function looksLikePlatanar(source: string): boolean {
  const s = source.toUpperCase();
  if (/FACTURA[_ ]?COMPRADOR/i.test(source)) return true;
  if (/SUBASTAPLATANAR|SUBASTA\s*PLATANAR/.test(s.replace(/\s+/g, ""))) return true;
  if (/3101842571/.test(s)) return true;
  if (/PESOBRUTO/.test(s.replace(/\s+/g, "")) && /PRECIOKILO/.test(s.replace(/\s+/g, ""))) {
    return /TORETE|TORO|NOVILLO/.test(s.replace(/\s+/g, ""));
  }
  return false;
}
