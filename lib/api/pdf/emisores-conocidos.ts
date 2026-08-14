/**
 * Catálogo de emisores conocidos (por cédula / ID de la clave CR).
 * Permite clasificar y nombrar incluso cuando el PDF es ilegible.
 */

export type EmisorConocido = {
  nombre: string;
  /** compra_ganado | gasto | venta (factura propia) | ignorar (p. ej. aceptación duplicada) */
  tipo: "compra_ganado" | "gasto" | "venta" | "ignorar";
  categoria?: string; // codigo categorias_gastos
};

/** Cédula de la granja Hermanos Herrera Parrales S.A. */
export const CEDULA_GRANJA = "3101029993";

export const EMISORES_CONOCIDOS: Record<string, EmisorConocido> = {
  // Propia granja → factura de VENTA (ingreso), no gasto ni compra
  [CEDULA_GRANJA]: {
    nombre: "HERMANOS HERRERA PARRALES S.A.",
    tipo: "venta",
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
  "3101028782": {
    nombre: "Petróleos Delta Costa Rica S.A.",
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
  "3101571453": {
    nombre: "Ferretería Arce Alfaro de Venecia S.A.",
    tipo: "gasto",
    categoria: "MANT",
  },
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
    categoria: "POL",
  },
  "4000042147": {
    nombre: "Caja Costarricense de Seguro Social",
    tipo: "gasto",
    categoria: "CCSS",
  },
  "4000002626": {
    nombre: "Instituto Costarricense de Electricidad (ICE)",
    tipo: "gasto",
    categoria: "SPUB",
  },
  "4000042139": {
    nombre: "Instituto Costarricense de Acueductos y Alcantarillados (AyA)",
    tipo: "gasto",
    categoria: "SPUB",
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
  // Filet de tilapia = comida humana / personal, no ración de ganado.
  "3101211148": {
    nombre: "Inversiones OSO / Tilapia",
    tipo: "gasto",
    categoria: "OTRO",
  },

  // Compra particular de ganado
  "203640613": {
    nombre: "Carlos Enrique Herrera Salas",
    tipo: "compra_ganado",
  },
  "0203640613": {
    nombre: "Carlos Enrique Herrera Salas",
    tipo: "compra_ganado",
  },
};

/** Overrides puntuales por nombre de archivo (cuando el PDF no entrega monto). */
export type FileOverride = {
  clasificacion: "compra_ganado" | "gasto" | "venta" | "ignorar";
  categoria?: string;
  monto?: number;
  pesoKg?: number;
  /** Comprador / cliente (solo clasificación venta). */
  buyer?: string;
  emisorNombre?: string;
  emisorId?: string;
  fecha?: string; // YYYY-MM-DD
  tipoAdquisicion?: "subasta" | "particular";
  descripcion?: string;
};

export function overrideForFileName(fileName: string): FileOverride | null {
  const n = fileName.toUpperCase();

  // Facturas de venta propias (facelcr.com — fuente custom; montos leídos del PDF visual)
  // Folio 361 — 2026-06-08 — 8 toros canal, 2359.30 kg × ₡2925
  if (n.includes("50608062600310102999300100001010000000361")) {
    return {
      clasificacion: "venta",
      fecha: "2026-06-08",
      monto: 6969962.03,
      pesoKg: 2359.3,
      buyer: "JIMMY FRANCISCO MATIAS JIMENEZ",
      emisorNombre: "HERMANOS HERRERA PARRALES S.A.",
      emisorId: CEDULA_GRANJA,
      descripcion: "GANADO CANAL 8 TOROS — boleta 97744",
    };
  }
  // Folio 363 — 2026-06-30 — 4 toros canal, 1242.1 kg × ₡2925
  if (n.includes("50630062600310102999300100001010000000363")) {
    return {
      clasificacion: "venta",
      fecha: "2026-06-30",
      monto: 3669473.93,
      pesoKg: 1242.1,
      buyer: "JIMMY FRANCISCO MATIAS JIMENEZ",
      emisorNombre: "HERMANOS HERRERA PARRALES S.A.",
      emisorId: CEDULA_GRANJA,
      descripcion: "GANADO CANAL 4 TOROS — boleta 98628",
    };
  }

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
      "40721171239535": { monto: 356386.58, fecha: "2026-07-20" },
      // 27-07-2026 — 43 sacos maíz 46 kg + flete zona 2
      "41242128711310": { monto: 356386.58, fecha: "2026-07-27" },
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

  // Ferretería Arce Alfaro — disco corte Dewalt (27-07-2026)
  if (n.includes("3101571453") || n.includes("00008010000032208")) {
    return {
      clasificacion: "gasto",
      categoria: "MANT",
      monto: 7500,
      fecha: "2026-07-27",
      emisorNombre: "Ferretería Arce Alfaro de Venecia S.A.",
      emisorId: "3101571453",
      descripcion: "DISCO CORTE FINO 7\" DEWALT ×3",
    };
  }

  // Super Mercados Unidos — víveres (27-07-2026)
  if (n.includes("3102007223") && n.includes("00042010000001594")) {
    return {
      clasificacion: "gasto",
      categoria: "OTRO",
      monto: 6190,
      fecha: "2026-07-27",
      emisorNombre: "Corporación Super Mercados Unidos SRL",
      emisorId: "3102007223",
      descripcion: "Víveres supermercado (jugo, queso, verduras, arroz)",
    };
  }

  // Estación Muelle — diésel 28.49 L (27-07-2026)
  if (n.includes("3101197187") && n.includes("00001010000799458")) {
    return {
      clasificacion: "gasto",
      categoria: "COMB",
      monto: 19459,
      fecha: "2026-07-27",
      emisorNombre: "Estación de Servicio Muelle",
      emisorId: "3101197187",
      descripcion: "Diésel 28.49 L",
    };
  }

  // OSO / tilapia filet (27-07-2026) — comida humana, no ración
  if (n.includes("3101211148") && (n.includes("0000000658") || n.includes("00400015010000000658"))) {
    return {
      clasificacion: "gasto",
      categoria: "OTRO",
      monto: 2400,
      fecha: "2026-07-27",
      emisorNombre: "Inversiones OSO / Tilapia",
      emisorId: "3101211148",
      descripcion: "SC / FILET DE TILAPIA ×1",
    };
  }

  // Diésel / tiquetes 074…
  if (/^07400/.test(n)) {
    return { clasificacion: "gasto", categoria: "COMB", emisorNombre: "Combustible / diésel" };
  }

  // Tilapia / OSO / Dos Pinos melaza — el monto se re-extrae del PDF
  if (n.includes("003004045002") || n.includes("FC-51") || n.includes("NC-51")) {
    if (n.includes("00402995")) {
      return {
        clasificacion: "gasto",
        categoria: "ALIM",
        monto: 47614.29,
        fecha: "2026-07-21",
        emisorNombre: "Cooperativa Dos Pinos R.L.",
        emisorId: "3004045002",
        descripcion: "REVALOR H — Dos Pinos",
      };
    }
    if (n.includes("00402769")) {
      return {
        clasificacion: "gasto",
        categoria: "VET",
        monto: 42925.67,
        fecha: "2026-07-20",
        emisorNombre: "Cooperativa Dos Pinos R.L.",
        emisorId: "3004045002",
        descripcion: "Sal ganadera y medicamentos Dos Pinos",
      };
    }
    return {
      clasificacion: "gasto",
      categoria: "ALIM",
      emisorNombre: "Cooperativa Dos Pinos R.L.",
      emisorId: "3004045002",
    };
  }

  // Herresal transporte jul-24 (fuente CID)
  if (n.includes("00000375100008081")) {
    return {
      clasificacion: "gasto",
      categoria: "TRANS",
      monto: 940500,
      fecha: "2026-07-24",
      emisorNombre: "Seis Hermanos Herresal S.A.",
      emisorId: "3101533933",
      descripcion: "Transporte / flete ganado (FE 00000375)",
    };
  }

  // Carlos E. Herrera Salas — ganado en pie
  if (n.includes("203640613") || n.includes("00161180614014")) {
    return {
      clasificacion: "compra_ganado",
      monto: 3052000,
      fecha: "2026-07-21",
      emisorNombre: "Carlos Enrique Herrera Salas",
      emisorId: "203640613",
      tipoAdquisicion: "particular",
      descripcion: "Compra 1 ganado en pie",
    };
  }

  // Mensajes de aceptación (MensajeReceptor): confirman una factura de proveedor
  // que YA se contabiliza por su propia factura → ignorar para no duplicar montos.
  if (n.includes("DOC-RECEPCION")) {
    return { clasificacion: "ignorar" };
  }
  // Comprobantes ilegibles / basura
  if (n.startsWith("COMPROBANTE639")) {
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
