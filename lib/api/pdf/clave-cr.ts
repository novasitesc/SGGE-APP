/**
 * Decodificador de la Clave Numérica de comprobantes electrónicos de Costa Rica.
 *
 * Estructura (50 dígitos):
 *   [3]  país (506)
 *   [2]  día
 *   [2]  mes
 *   [2]  año
 *   [12] identificación del emisor (cédula física/jurídica, con ceros a la izq.)
 *   [20] consecutivo: sucursal(3) + terminal(5) + tipoDoc(2) + número(10)
 *   [1]  situación del comprobante (1=normal, 2=contingencia, 3=sin internet)
 *   [8]  código de seguridad
 *
 * La clave suele venir también en el NOMBRE del archivo, por lo que es la
 * fuente más confiable incluso cuando el texto del PDF es ilegible.
 */

const TIPO_DOC: Record<string, string> = {
  "01": "factura",
  "02": "nota_debito",
  "03": "nota_credito",
  "04": "tiquete",
  "05": "confirmacion_aceptacion",
  "06": "confirmacion_aceptacion_parcial",
  "07": "confirmacion_rechazo",
  "08": "factura_compra",
  "09": "factura_exportacion",
};

export type ClaveCR = {
  clave: string;
  fechaEmision: string | null; // YYYY-MM-DD
  emisorIdentificacion: string; // sin ceros a la izquierda
  tipoDocumentoCodigo: string;
  tipoDocumento: string;
  consecutivo: string;
};

/** Extrae la primera clave de 50 dígitos de un texto (o nombre de archivo). */
export function findClaveCR(source: string): string | null {
  const digitsOnly = source.replace(/[^0-9]/g, " ");
  const match = digitsOnly.match(/\b(\d{50})\b/);
  if (match) return match[1];
  // Algunos nombres traen la clave pegada a otros dígitos; toma la primera corrida de 50.
  const loose = source.replace(/\D/g, "");
  if (loose.length >= 50) {
    const candidate = loose.slice(0, 50);
    if (candidate.startsWith("506")) return candidate;
  }
  return null;
}

export function parseClaveCR(clave: string): ClaveCR | null {
  const c = clave.replace(/\D/g, "");
  if (c.length !== 50 || !c.startsWith("506")) return null;

  const dd = c.slice(3, 5);
  const mm = c.slice(5, 7);
  const yy = c.slice(7, 9);
  const emisor = c.slice(9, 21);
  const consecutivo = c.slice(21, 41);
  const tipoDoc = consecutivo.slice(8, 10);

  const day = Number(dd);
  const month = Number(mm);
  const year = 2000 + Number(yy);
  let fechaEmision: string | null = null;
  if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
    fechaEmision = `${year}-${mm}-${dd}`;
  }

  return {
    clave: c,
    fechaEmision,
    emisorIdentificacion: emisor.replace(/^0+/, "") || emisor,
    tipoDocumentoCodigo: tipoDoc,
    tipoDocumento: TIPO_DOC[tipoDoc] ?? "desconocido",
    consecutivo,
  };
}
