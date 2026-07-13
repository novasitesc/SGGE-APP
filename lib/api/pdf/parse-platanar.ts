import { normalizeSpacedPdfText, looksLikePlatanar } from "./normalize-spaced";
import { parseCrNumber } from "./cr-number";

export type PlatanarAnimalLine = {
  codigo: string; // p.ej. "0107"
  tipo: string; // TORETE | TORO | ...
  color: string;
  vendedor: string;
  pesoKg: number;
  precioKg: number;
  monto: number;
};

export type PlatanarParseResult = {
  isPlatanar: boolean;
  folio: string | null;
  fechaEmision: string | null; // YYYY-MM-DD
  emisorNombre: string;
  emisorIdentificacion: string;
  pesoTotalKg: number | null;
  subtotal: number | null;
  total: number | null;
  animales: PlatanarAnimalLine[];
  textoNormalizado: string;
};

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

const TIPOS =
  "TORETES|TORETE|TOROS|TORO|NOVILLOS|NOVILLO|NOVILLAS|NOVILLA|VAQUILLAS|VAQUILLA|TERNEROS|TERNERO|TERNERAS|TERNERA|VACAS|VACA";
const COLORES =
  "ENTREPELADO|COLORADO|CAFEADO|NEGRO|ROJO|BAYO|JOSCO|HOSCO|GRIS|SARDO|BLANCO|OVERO|PINTO|PINTA";

/**
 * Tras colapsar espacios entre letras, las líneas quedan así:
 *   NO0124TORETEROJOALDAIRDELOSANGELES291.001,290.00375,390.00
 * El primer animal a veces pierde el prefijo NO al pegarse al IBAN:
 *   ...053030107TORETENEGROJULIO...
 */
const ANIMAL_RE = new RegExp(
  String.raw`(?:NO)?(\d{4})(${TIPOS})(${COLORES})([A-ZÁÉÍÓÚÑÜ]{3,80}?)(\d{2,4}\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})`,
  "gi"
);

function parseSpanishDate(text: string): string | null {
  const m = text.match(
    /(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*de\s*(\d{4})/i
  );
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = MESES[m[2].toLowerCase()];
  const year = m[3];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function extractFolio(text: string, fileName?: string): string | null {
  const compact = text.replace(/\s+/g, "");
  const fromText =
    compact.match(/FACTURACREDITO(\d{8})/i) ??
    compact.match(/FACTURA(?:CREDITO)?#?(\d{8})/i);
  if (fromText) return fromText[1];

  const fromName = fileName?.match(/FACTURA_COMPRADOR_0*(\d+)/i);
  return fromName ? fromName[1].padStart(8, "0") : null;
}

/** Extrae monto etiquetado sin confundir PesoTotal con TOTAL. */
function extractLabeledMoney(text: string, label: string): number | null {
  const compact = text.replace(/\s+/g, "");
  // Frontera izquierda: no letra (evita "PesoTotal" cuando label="TOTAL").
  const re = new RegExp(`(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])${label}([\\d,]{1,15}\\.\\d{2})`, "i");
  const m = compact.match(re);
  if (!m) return null;
  return parseCrNumber(m[1]);
}

function singularTipo(raw: string): string {
  const t = raw.toUpperCase();
  const map: Record<string, string> = {
    TORETES: "TORETE",
    TOROS: "TORO",
    NOVILLOS: "NOVILLO",
    NOVILLAS: "NOVILLA",
    VAQUILLAS: "VAQUILLA",
    TERNEROS: "TERNERO",
    TERNERAS: "TERNERA",
    VACAS: "VACA",
  };
  return map[t] ?? t;
}

function humanizeVendor(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Parsea una factura de comprador de Subasta Platanar.
 * Devuelve animales con peso, ₡/kg y monto, más totales del encabezado.
 */
export function parsePlatanarFactura(
  rawText: string,
  fileName?: string
): PlatanarParseResult {
  const textoNormalizado = normalizeSpacedPdfText(rawText);
  const isPlatanar =
    looksLikePlatanar(fileName ?? "") ||
    looksLikePlatanar(textoNormalizado) ||
    looksLikePlatanar(rawText);

  const animales: PlatanarAnimalLine[] = [];
  const seen = new Set<string>();

  if (isPlatanar || /TORETE|TORO/.test(textoNormalizado)) {
    ANIMAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ANIMAL_RE.exec(textoNormalizado)) !== null) {
      const pesoKg = parseCrNumber(m[5]);
      const precioKg = parseCrNumber(m[6]);
      const monto = parseCrNumber(m[7]);
      if (pesoKg == null || precioKg == null || monto == null) continue;
      // Sanity: peso de ganado entre 50 y 1200 kg; precio típico 100–10000 ₡/kg
      if (pesoKg < 50 || pesoKg > 1200) continue;
      if (precioKg < 100 || precioKg > 10000) continue;
      // Monto ≈ peso × precio (tolerancia 15 % por redondeos)
      const expected = pesoKg * precioKg;
      if (expected > 0 && Math.abs(monto - expected) / expected > 0.15) continue;

      const codigo = m[1];
      const key = `${codigo}|${pesoKg}|${monto}`;
      if (seen.has(key)) continue;
      seen.add(key);

      animales.push({
        codigo,
        tipo: singularTipo(m[2]),
        color: m[3].toUpperCase(),
        vendedor: humanizeVendor(m[4]),
        pesoKg,
        precioKg,
        monto,
      });
    }
  }

  const pesoTotalKg =
    extractLabeledMoney(textoNormalizado, "PesoTotal") ??
    (animales.length
      ? Math.round(animales.reduce((s, a) => s + a.pesoKg, 0) * 100) / 100
      : null);

  const subtotal =
    extractLabeledMoney(textoNormalizado, "SUBTOTAL") ??
    (animales.length
      ? Math.round(animales.reduce((s, a) => s + a.monto, 0) * 100) / 100
      : null);

  const total =
    extractLabeledMoney(textoNormalizado, "TOTAL") ??
    subtotal;

  return {
    isPlatanar: isPlatanar || animales.length > 0,
    folio: extractFolio(textoNormalizado, fileName),
    fechaEmision: parseSpanishDate(textoNormalizado),
    emisorNombre: "SUBASTA PLATANAR SC S.A.",
    emisorIdentificacion: "3101842571",
    pesoTotalKg,
    subtotal,
    total,
    animales,
    textoNormalizado,
  };
}
