/**
 * Decodifica texto de PDFs costarricenses con fuentes custom
 * (Super Mercados, Lubricentro, FE tilapia, etc.):
 *  1) Glifos en rango !–: son A–Z almacenados como code-32
 *  2) Letras César +3 → se revierten con −3
 */
export function decodeCustomPdfText(input: string): string {
  let out = "";
  for (const ch of input) {
    let code = ch.charCodeAt(0);
    // Símbolos/dígitos que en realidad son A–Z (César) guardados como code−32
    if (code >= 33 && code <= 58) {
      code += 32;
    }
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
      continue;
    }
    if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
      continue;
    }
    out += ch;
  }
  return out;
}
