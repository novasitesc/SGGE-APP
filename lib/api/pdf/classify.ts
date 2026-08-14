import type { ParsedComprobante } from "./parse-comprobante";
import { lookupEmisor, CEDULA_GRANJA } from "./emisores-conocidos";

export type Clasificacion =
  | "compra_ganado"
  | "gasto"
  | "venta"
  | "pendiente"
  | "ignorar";

/** Tipos de documento (código 50-clave) que representan una venta de la granja. */
const DOC_VENTA = new Set(["factura", "tiquete", "nota_debito", "nota_credito"]);

export type ClassificationResult = {
  clasificacion: Clasificacion;
  categoriaSugerida: string | null; // código de categorias_gastos
  confianza: number; // 0-100
  motivo: string;
};

/** Identificaciones conocidas de emisores de ganado (subastas / ganaderos). */
const EMISORES_GANADO = new Set<string>([
  "3101842571", // Subasta Ganadera Platanar
]);

const GANADO_KEYWORDS = [
  "subasta",
  "toro",
  "torete",
  "toretes",
  "novillo",
  "novilla",
  "vaquilla",
  "ternero",
  "ternera",
  "semoviente",
  "peso bruto",
  "precio kilo",
  "precio/kilo",
  "venta de un toro",
  "cabeza de ganado",
  "guia",
  "hierro",
];

type CategoriaRule = { codigo: string; keywords: string[] };

// Orden importa: la primera regla que haga match gana.
const CATEGORIA_RULES: CategoriaRule[] = [
  // Nota: tilapia/filet NO van aquí (comida humana → OTRO vía emisor OSO).
  { codigo: "ALIM", keywords: ["alimento", "concentrado", "melaza", "pastura", "forraje", "sal mineral", "racion", "maiz", "maíz", "engorde", "avin", "avicultor", "grofactor"] },
  { codigo: "COMB", keywords: ["diesel", "diésel", "gasolina", "combustible", "estacion de servicio", "estación de servicio", "gas "] },
  { codigo: "VET", keywords: [
    "medicamento", "vacuna", "desparasit", "antibiotico", "antibiótico", "veterinar", "farmacia",
    "baytril", "partovet", "histaminex", "carbolina", "ivermect", "draxxin", "cydectin",
    "baycox", "doramect", "moxidect", "albendaz", "ceftiofur", "flunixin",
  ] },
  { codigo: "MANT", keywords: ["cemento", "varilla", "arena", "soldadura", "hierro", "materiales", "ferreter", "contenedor", "esquivel", "tornillo", "pintura", "tuberia", "tubería", "lubricentro", "repuesto", "motosierra", "disco", "angular", "platina"] },
  { codigo: "TRANS", keywords: ["transporte", "flete", "acarreo", "porteo"] },
  {
    codigo: "POL",
    keywords: [
      "póliza",
      "poliza",
      "riesgos del trabajo",
      "instituto nacional de seguros",
      "prima de seguro",
    ],
  },
  {
    codigo: "CCSS",
    keywords: [
      "ccss",
      "caja costarricense",
      "cuota obrero",
      "cuota obrero-patronal",
      "seguro social",
    ],
  },
  {
    codigo: "SPUB",
    keywords: [
      "instituto costarricense de electricidad",
      "acueductos y alcantarillados",
      "compañía nacional de fuerza",
      "cnel",
      "kolbi",
      "recibo de electricidad",
      "recibo de agua",
    ],
  },
  { codigo: "SAL", keywords: ["planilla", "salario", "sueldo", "aguinaldo"] },
  { codigo: "VIAT", keywords: ["viático", "viatico", "viáticos", "viaticos"] },
  { codigo: "SERV", keywords: ["contabilidad", "honorarios", "servicios profesionales", "asesoria", "asesoría", "legal", "auditoria", "auditoría"] },
];

export function classifyComprobante(parsed: ParsedComprobante): ClassificationResult {
  const text = `${parsed.texto} ${parsed.emisorNombre ?? ""} ${parsed.clave ?? ""}`.toLowerCase();
  const animalCount = parsed.animales?.length ?? 0;
  const emisorKnown = lookupEmisor(parsed.emisorIdentificacion);

  // Documento emitido por la propia granja.
  if (parsed.emisorIdentificacion === CEDULA_GRANJA) {
    // factura_compra (autofactura) = compra a un no contribuyente → cae en las
    // reglas de ganado/gasto más abajo. Los demás documentos (factura, tiquete,
    // notas) son una VENTA de la granja.
    if (parsed.tipoDocumento == null || DOC_VENTA.has(parsed.tipoDocumento)) {
      return {
        clasificacion: "venta",
        categoriaSugerida: null,
        confianza: 96,
        motivo: "Factura de venta emitida por la propia granja.",
      };
    }
  } else if (emisorKnown?.tipo === "ignorar") {
    return {
      clasificacion: "ignorar",
      categoriaSugerida: null,
      confianza: 99,
      motivo: "Emisor marcado como ignorar (no es egreso a terceros).",
    };
  }

  // 0) Líneas de animales extraídas (Subasta Platanar, etc.).
  if (animalCount > 0 || parsed.origenParser === "platanar") {
    return {
      clasificacion: "compra_ganado",
      categoriaSugerida: null,
      confianza: animalCount > 0 ? 98 : 90,
      motivo:
        animalCount > 0
          ? `Subasta/remate: ${animalCount} animal(es) detectado(s).`
          : "Factura de Subasta Platanar (sin líneas parseadas).",
    };
  }

  // Productos veterinarios fuertes (facturas mixtas Dos Pinos, etc.)
  const vetStrong = [
    "baytril", "partovet", "histaminex", "carbolina", "ivermect",
    "draxxin", "cydectin", "baycox", "doramect", "antibiot", "antibiótico",
    "medicamento", "vacuna", "desparasit", "farmacia",
  ];
  const vetHit = vetStrong.find((k) => text.includes(k));

  // 1) Emisor conocido de ganado / gasto por cédula.
  if (emisorKnown?.tipo === "compra_ganado") {
    return {
      clasificacion: "compra_ganado",
      categoriaSugerida: null,
      confianza: 95,
      motivo: `Emisor conocido: ${emisorKnown.nombre}.`,
    };
  }
  if (emisorKnown?.tipo === "gasto") {
    // Factura Dos Pinos (ALIM) con Baytril/Partovet → priorizar VET
    if (vetHit && (emisorKnown.categoria === "ALIM" || !emisorKnown.categoria)) {
      return {
        clasificacion: "gasto",
        categoriaSugerida: "VET",
        confianza: 90,
        motivo: `Emisor ${emisorKnown.nombre} con producto veterinario "${vetHit}" → VET.`,
      };
    }
    return {
      clasificacion: "gasto",
      categoriaSugerida: emisorKnown.categoria ?? "OTRO",
      confianza: 88,
      motivo: `Emisor conocido (${emisorKnown.categoria ?? "OTRO"}): ${emisorKnown.nombre}.`,
    };
  }

  if (parsed.emisorIdentificacion && EMISORES_GANADO.has(parsed.emisorIdentificacion)) {
    return {
      clasificacion: "compra_ganado",
      categoriaSugerida: null,
      confianza: 95,
      motivo: "Emisor identificado como subasta/ganadero.",
    };
  }

  // 2) Palabras clave de ganado.
  const ganadoHits = GANADO_KEYWORDS.filter((k) => text.includes(k));
  if (ganadoHits.length >= 2 || text.includes("subasta") || text.includes("venta de un toro")) {
    return {
      clasificacion: "compra_ganado",
      categoriaSugerida: null,
      confianza: ganadoHits.length >= 2 ? 85 : 70,
      motivo: `Indicios de ganado: ${ganadoHits.slice(0, 4).join(", ") || "subasta"}.`,
    };
  }

  // 3a) Productos veterinarios fuertes (emisores no conocidos).
  if (vetHit) {
    return {
      clasificacion: "gasto",
      categoriaSugerida: "VET",
      confianza: 82,
      motivo: `Gasto (VET) por término "${vetHit}".`,
    };
  }

  // 3b) Resto de categorías de gasto por palabras clave.
  for (const rule of CATEGORIA_RULES) {
    if (rule.codigo === "VET") continue; // ya evaluado arriba
    const hit = rule.keywords.find((k) => text.includes(k));
    if (hit) {
      return {
        clasificacion: "gasto",
        categoriaSugerida: rule.codigo,
        confianza: 75,
        motivo: `Gasto (${rule.codigo}) por término "${hit}".`,
      };
    }
  }

  // 4) Si hay clave/monto pero sin señales claras → gasto genérico.
  if (parsed.montoTotal != null || parsed.clave) {
    return {
      clasificacion: "gasto",
      categoriaSugerida: "OTRO",
      confianza: parsed.montoTotal != null ? 40 : 30,
      motivo: "Sin indicios claros; se sugiere gasto (Otros).",
    };
  }

  return {
    clasificacion: "pendiente",
    categoriaSugerida: null,
    confianza: 0,
    motivo: "No se pudo clasificar automáticamente.",
  };
}
