/**
 * Catálogo de emisores conocidos (por cédula / ID de la clave CR).
 * Permite clasificar y nombrar incluso cuando el PDF es ilegible.
 */

export type EmisorConocido = {
  nombre: string;
  /** compra_ganado | gasto | ignorar (factura emitida por la propia granja) */
  tipo: "compra_ganado" | "gasto" | "ignorar";
  categoria?: string; // codigo categorias_gastos
};

/** Cédula de la granja Hermanos Herrera Parrales S.A. */
export const CEDULA_GRANJA = "3101029993";

export const EMISORES_CONOCIDOS: Record<string, EmisorConocido> = {
  // Propia granja → no es un gasto/compra a terceros
  [CEDULA_GRANJA]: {
    nombre: "HERMANOS HERRERA PARRALES S.A.",
    tipo: "ignorar",
  },

  // Ganado
  "3101842571": {
    nombre: "SUBASTA PLATANAR SC S.A.",
    tipo: "compra_ganado",
  },

  // Combustible
  "3101197187": {
    nombre: "Estación de Servicio Muelle",
    tipo: "gasto",
    categoria: "COMB",
  },
  "3101383363": {
    nombre: "Alimentos de Avicultores Integrados AVIN S.A.",
    tipo: "gasto",
    categoria: "ALIM",
  },
  "3102007223": {
    nombre: "Corporación Super Mercados Unidos SRL",
    tipo: "gasto",
    categoria: "ALIM",
  },

  // Materiales / ferretería / lubricentro
  "3102864764": {
    nombre: "Materiales E y S Inversiones Esquivel y Sánchez",
    tipo: "gasto",
    categoria: "MANT",
  },
  "3101747184": {
    nombre: "Materiales / Ferretería",
    tipo: "gasto",
    categoria: "MANT",
  },
  "3102965856": {
    nombre: "Lubricentro Macho",
    tipo: "gasto",
    categoria: "MANT",
  },

  // Alimentación — Cooperativa Dos Pinos (melaza, etc.)
  "3004045002": {
    nombre: "Cooperativa de Productores de Leche Dos Pinos R.L.",
    tipo: "gasto",
    categoria: "ALIM",
  },

  // Servicios profesionales / contabilidad
  "106530951": {
    nombre: "Servicios de contabilidad",
    tipo: "gasto",
    categoria: "SERV",
  },
  "0106530951": {
    nombre: "Servicios de contabilidad",
    tipo: "gasto",
    categoria: "SERV",
  },

  "3101430036": {
    nombre: "Proveedor",
    tipo: "gasto",
    categoria: "OTRO",
  },
  "4000001902": {
    nombre: "Instituto Nacional de Seguros (INS)",
    tipo: "gasto",
    categoria: "OTRO",
  },
  "3101533933": {
    nombre: "Seis Hermanos Herresal S.A.",
    tipo: "gasto",
    categoria: "TRANS",
  },
  "3101546580": {
    nombre: "Corporación ZUCA C.Z. S.A.",
    tipo: "gasto",
    categoria: "MANT",
  },
  "3101211148": {
    nombre: "Inversiones OSO / Tilapia",
    tipo: "gasto",
    categoria: "ALIM",
  },
};

/** Overrides puntuales por nombre de archivo (cuando el PDF no entrega monto). */
export type FileOverride = {
  clasificacion: "compra_ganado" | "gasto" | "ignorar";
  categoria?: string;
  monto?: number;
  pesoKg?: number;
  emisorNombre?: string;
  emisorId?: string;
  fecha?: string; // YYYY-MM-DD
  tipoAdquisicion?: "subasta" | "particular";
  descripcion?: string;
};

export function overrideForFileName(fileName: string): FileOverride | null {
  const n = fileName.toUpperCase();

  // Compra particular de ganado (conocidas del lote PDF/)
  if (n.includes("506180626155818519919") || n.includes("JADER")) {
    return {
      clasificacion: "compra_ganado",
      monto: 764150,
      pesoKg: 527,
      emisorNombre: "JADER DINARTE MIRANDA",
      emisorId: "155818519919",
      fecha: "2026-06-18",
      tipoAdquisicion: "particular",
      descripcion: "Venta de 1 toro (527 kg)",
    };
  }
  if (n.includes("BOOK 2") || n.includes("ALLAN") || n.includes("BARRET")) {
    return {
      clasificacion: "compra_ganado",
      monto: 400000,
      pesoKg: 400, // estimado si no hay peso; se ajusta con el formulario si hace falta
      emisorNombre: "ALLAN BARRETT",
      fecha: "2026-06-01",
      tipoAdquisicion: "particular",
      descripcion: "Compra de 1 toro",
    };
  }

  // AVIN — maíz / alimento engorde (PDFs con fuente CID; montos conocidos del lote)
  if (n.includes("3101383363")) {
    const avinByClave: Record<string, { monto: number; fecha: string }> = {
      "39664159698705": { monto: 361163.88, fecha: "2026-07-06" },
      "37431176010314": { monto: 285571.44, fecha: "2026-06-08" },
      "37931111605510": { monto: 335966.4, fecha: "2026-06-15" },
      "38547100387650": { monto: 327567.24, fecha: "2026-06-22" },
      "39116109137559": { monto: 386361.36, fecha: "2026-06-29" },
    };
    for (const [suf, v] of Object.entries(avinByClave)) {
      if (n.includes(suf)) {
        return {
          clasificacion: "gasto",
          categoria: "ALIM",
          monto: v.monto,
          fecha: v.fecha,
          emisorNombre: "Alimentos de Avicultores Integrados AVIN S.A.",
          emisorId: "3101383363",
          descripcion: "Maíz molido + flete (AVIN / engorde)",
        };
      }
    }
    return {
      clasificacion: "gasto",
      categoria: "ALIM",
      emisorNombre: "Alimentos de Avicultores Integrados AVIN S.A.",
      emisorId: "3101383363",
      descripcion: "Alimento AVIN",
    };
  }

  // Diésel / tiquetes 074…
  if (/^07400/.test(n)) {
    return { clasificacion: "gasto", categoria: "COMB", emisorNombre: "Combustible / diésel" };
  }

  // Tilapia / OSO / Dos Pinos melaza — el monto se re-extrae del PDF
  if (n.includes("003004045002") || n.includes("FC-51") || n.includes("NC-51")) {
    return {
      clasificacion: "gasto",
      categoria: "ALIM",
      emisorNombre: "Cooperativa Dos Pinos R.L.",
      emisorId: "3004045002",
    };
  }

  // Comprobantes ilegibles de recepción / basura
  if (n.startsWith("COMPROBANTE639") || n.includes("DOC-RECEPCION")) {
    return { clasificacion: "gasto", categoria: "OTRO" };
  }

  // Extracto BN generado desde capturas (CPLESCA / CHAMBACU)
  if (n.includes("BN-EXTRACTO-")) {
    const entidad = n.includes("CHAMBACU") ? "CHAMBACU" : n.includes("CPLESCA") ? "CPLESCA" : "Banco Nacional";
    return {
      clasificacion: "gasto",
      categoria: "OTRO",
      emisorNombre: entidad,
      descripcion: `Movimiento bancario BN — ${entidad}`,
    };
  }

  return null;
}

export function lookupEmisor(id: string | null | undefined): EmisorConocido | null {
  if (!id) return null;
  const raw = id.replace(/^0+/, "") || id;
  return (
    EMISORES_CONOCIDOS[id] ??
    EMISORES_CONOCIDOS[raw] ??
    EMISORES_CONOCIDOS[id.padStart(12, "0")] ??
    null
  );
}
