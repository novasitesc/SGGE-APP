import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultLoteId } from "@/lib/api/animales-query";

export type ProductoAlim = {
  codigo: string;
  nombre: string;
  tipo: string;
  unidad: string;
};

export type CantidadAlimDetectada = {
  cantidad: number;
  unidad: "kg" | "saco" | "und";
  fuente: string;
};

/** Parsea cantidades CR/US: `9,740` → 9740; `1,311.80` → 1311.80; `9,74` → 9.74 */
export function parseCantidadNumero(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  let normalized: string;
  if (t.includes(",") && t.includes(".")) {
    // El último separador es el decimal.
    if (t.lastIndexOf(".") > t.lastIndexOf(",")) {
      normalized = t.replace(/,/g, "");
    } else {
      normalized = t.replace(/\./g, "").replace(",", ".");
    }
  } else if (t.includes(",")) {
    // `9,740` / `1,311,198` (miles) vs `9,74` (decimal).
    if (/^\d{1,3}(,\d{3})+$/.test(t)) {
      normalized = t.replace(/,/g, "");
    } else if (/^\d+,\d{1,2}$/.test(t)) {
      normalized = t.replace(",", ".");
    } else {
      normalized = t.replace(/,/g, "");
    }
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Indicios de alimento de ganado (masa). Vet/ml no cuentan. */
export function textoTieneAlimentoGanado(texto: string): boolean {
  return /MELAZA\s*KG|MELAZAKG|GROFACTOR|MA[IÍ]Z\s*MOLIDO|CONCENTRAD(?:O|OR)?\s*(?:ENGORDA|BOV)/i.test(
    texto
  );
}

/** Intenta leer kg/sacos del texto del PDF (heurística; el usuario puede corregir). */
export function extractCantidadAlimentoFromText(
  texto: string,
  montoTotal?: number | null
): CantidadAlimDetectada | null {
  if (!texto?.trim()) return null;
  // No inventar kg desde facturas vet (ml/CC/dosis) u otras no-masa.
  if (
    !textoTieneAlimentoGanado(texto) &&
    /BAYTRIL|REVALOR|VIRBAMEC|PARTOVET|DORAMEC|ABAXTION|MULTIFORT|HISTAMINEX|250\s*CC|500\s*ML/i.test(
      texto
    )
  ) {
    return null;
  }
  const compact = texto.replace(/\s+/g, " ");
  const monto = montoTotal != null ? Number(montoTotal) : null;

  type Cand = CantidadAlimDetectada & { score: number };
  const cands: Cand[] = [];

  const push = (
    raw: string,
    unidad: CantidadAlimDetectada["unidad"],
    fuente: string,
    score: number
  ) => {
    const n = parseCantidadNumero(raw);
    if (n == null || n > 500_000) return;
    // Evitar confundir el total de la factura con una cantidad.
    if (monto != null && Math.abs(n - monto) < 0.02) return;
    if (unidad === "kg" && n < 1) return;
    cands.push({ cantidad: n, unidad, fuente: fuente.slice(0, 48), score });
  };

  // Dos Pinos / melaza: "MELAZA KG" + "9,740 134.62" (también sin espacios: MELAZAKG9,740).
  const melazaLine =
    /MELAZA(?:\s*MINERALIZADA)?\s*KG\s*([\d.,]+)\s+([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = melazaLine.exec(compact)) !== null) {
    push(m[1], "kg", m[0], 50);
  }
  const noSpace = compact.replace(/\s+/g, "");
  // Sin espacios: MELAZAKG9,740134.62 → qty + precio unitario.
  const melazaCompact =
    /MELAZA(?:MINERALIZADA)?KG(\d{1,3}(?:,\d{3})+|\d+)(\d{1,7}\.\d{2})/gi;
  while ((m = melazaCompact.exec(noSpace)) !== null) {
    push(m[1], "kg", `MELAZAKG${m[1]} ${m[2]}`, 50);
  }

  // Dos Pinos: "GROFACTOR KILO 10 139,000.00" → cant. 10.
  // No usar versión sin espacios: GROFACTORKILO10139,000.00 ambigua (10 vs 1013).
  const grofactor =
    /GROFACTOR\s*KILO\s*([\d.,]+)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/gi;
  while ((m = grofactor.exec(compact)) !== null) {
    push(m[1], "kg", m[0], 52);
  }

  // AVIN: "Maiz Molido 46 kg" + cantidad en sacos (ej. 34.00000) → kg = sacos × 46.
  const avinMaiz = /Ma[ií]z\s*Molido\s*46\s*kg/i.test(compact);
  if (avinMaiz) {
    const avinQty =
      /Ma[ií]z\s*Molido\s*46\s*kg[\s\S]{0,320}?(\d{1,4}\.\d{5})\s+CRC\s+([\d,]+\.\d{5})/i.exec(
        compact
      );
    if (avinQty) {
      const sacos = Number(avinQty[1]);
      if (Number.isFinite(sacos) && sacos > 0 && sacos < 5000) {
        const kg = Math.round(sacos * 46 * 1000) / 1000;
        cands.push({
          cantidad: kg,
          unidad: "kg",
          fuente: `AVIN ${sacos} sacos × 46 kg`,
          score: 55,
        });
      }
    }
  }

  // Pie Dos Pinos: solo si hay línea de alimento (melaza/grofactor).
  // En facturas vet/ferretería "Cantidad Unidades" NO es kg de melaza.
  const hasAlimDosPinos = /MELAZA\s*KG|MELAZAKG|GROFACTOR\s*KILO|GROFACTORKILO/i.test(
    compact
  );
  if (hasAlimDosPinos) {
    const cantUnidades =
      /Cantidad\s*Unidades\s*Cantidad\s*de\s*L[ií]neas\s*([\d.,]+)\s+(\d{1,3})\b/gi;
    while ((m = cantUnidades.exec(compact)) !== null) {
      push(m[1], "kg", `Cantidad Unidades ${m[1]}`, 40);
    }
    const cantUnidadesCompact =
      /CantidadUnidadesCantidaddeL[ií]neas(\d{1,3}(?:,\d{3})+|\d{2,})(\d{1,3})(?=Plazo|N[uú]mero|$)/gi;
    while ((m = cantUnidadesCompact.exec(noSpace)) !== null) {
      push(m[1], "kg", `CantidadUnidades ${m[1]}`, 40);
    }
  }

  const labeledKg =
    /(?:cantidad|cant\.?|peso|kilos?)\s*[:.]?\s*([\d.,]+)\s*(?:kg|kgs|kilos?)?\b/gi;
  while ((m = labeledKg.exec(compact)) !== null) {
    push(m[1], "kg", m[0], 30);
  }

  const plainKg = /([\d.,]+)\s*(?:kg|kgs|kilos?)\b/gi;
  while ((m = plainKg.exec(compact)) !== null) {
    push(m[1], "kg", m[0], 20);
  }

  const sacos = /([\d.,]+)\s*sacos?\b/gi;
  while ((m = sacos.exec(compact)) !== null) {
    push(m[1], "saco", m[0], 15);
  }

  if (cands.length === 0) return null;
  cands.sort((a, b) => b.score - a.score || b.cantidad - a.cantidad);
  const best = cands[0];
  return {
    cantidad: Math.round(best.cantidad * 1000) / 1000,
    unidad: best.unidad,
    fuente: best.fuente,
  };
}

/**
 * Mapea emisor / concepto de factura ALIM → producto de catálogo.
 * Devuelve null si no hay alimento de ganado (p.ej. Dos Pinos solo vet/ml).
 * No inventa kg ni solapa vet en melaza.
 */
export function resolveProductoAlim(input: {
  emisorId?: string | null;
  emisorNombre?: string | null;
  concepto?: string | null;
  archivoNombre?: string | null;
  texto?: string | null;
}): ProductoAlim | null {
  const id = (input.emisorId ?? "").replace(/^0+/, "");
  const blob = `${input.emisorNombre ?? ""} ${input.concepto ?? ""} ${input.archivoNombre ?? ""} ${input.texto ?? ""}`.toLowerCase();
  const texto = input.texto ?? "";

  if (id === "3101383363" || blob.includes("avin") || /ma[ií]z\s*molido/i.test(blob + texto)) {
    return {
      codigo: "MAIZ-AVIN",
      nombre: "Maíz molido (AVIN)",
      tipo: "concentrado",
      unidad: "kg",
    };
  }

  const isDosPinos =
    id === "3004045002" || blob.includes("dos pinos") || /003004045002/i.test(blob);
  if (isDosPinos || blob.includes("melaza") || blob.includes("grofactor")) {
    if (/grofactor/i.test(blob + texto)) {
      return {
        codigo: "GRO-DP",
        nombre: "Grofactor / concentrado Dos Pinos",
        tipo: "concentrado",
        unidad: "kg",
      };
    }
    if (/melaza/i.test(blob + texto) || textoTieneAlimentoGanado(texto)) {
      return {
        codigo: "MEL-DP",
        nombre: "Melaza Dos Pinos",
        tipo: "melaza",
        unidad: "kg",
      };
    }
    // Dos Pinos sin línea de alimento → no crear compra ALIM (va a VET/MANT).
    if (isDosPinos) return null;
  }

  if (id === "3102007223" || blob.includes("super mercados") || blob.includes("walmart")) {
    // Comida humana / und — no stock de engorda en kg.
    return null;
  }

  if (blob.includes("vitamina") || blob.includes("mineral")) {
    // Solo si el concepto parece suplemento alimenticio, no vet genérico.
    if (/suplement|premezcla|sal\s*mineral|bloque/i.test(blob)) {
      return {
        codigo: "VIT-MIN",
        nombre: "Vitaminas / minerales",
        tipo: "suplemento",
        unidad: "kg",
      };
    }
  }

  // Sin indicios claros de alimento de ganado: no inventar producto ni kg.
  if (!textoTieneAlimentoGanado(texto) && !/melaza|ma[ií]z|concentrad|forraje|ensil/i.test(blob)) {
    return null;
  }

  const nombre =
    (input.concepto ?? "").trim().slice(0, 80) ||
    (input.emisorNombre ?? "").trim().slice(0, 80) ||
    "Insumo alimentación";
  const codigo =
    "ALIM-" +
    nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .slice(0, 10)
      .toUpperCase();

  return {
    codigo: codigo || "ALIM-GEN",
    nombre,
    tipo: "otro",
    unidad: "kg",
  };
}

const SEED_ALIASES: Record<string, string[]> = {
  "MEL-DP": ["MEL-MIN", "MEL-DP"],
  "MAIZ-AVIN": ["CON-ENG", "MAIZ-AVIN"],
  "GRO-DP": ["CON-ENG", "GRO-DP"],
};

async function findAlimentoByCodigos(
  admin: SupabaseClient,
  granjaId: string,
  codigos: string[]
) {
  const { data } = await admin
    .from("alimentos")
    .select("id, costo_unitario, codigo")
    .eq("granja_id", granjaId)
    .in("codigo", codigos)
    .is("deleted_at", null);
  if (!data?.length) return null;
  for (const code of codigos) {
    const hit = data.find((r) => r.codigo === code);
    if (hit) return hit;
  }
  return data[0];
}

async function upsertAlimento(
  admin: SupabaseClient,
  granjaId: string,
  producto: ProductoAlim,
  costoUnitario: number
): Promise<{ id: string; costo_unitario: number }> {
  const codigos = SEED_ALIASES[producto.codigo] ?? [producto.codigo];
  const existing = await findAlimentoByCodigos(admin, granjaId, codigos);

  if (existing?.id) {
    // No pisar precio de catálogo con el total de factura (suele ser monto de lote).
    return {
      id: existing.id,
      costo_unitario: Number(existing.costo_unitario),
    };
  }

  const { data: created, error } = await admin
    .from("alimentos")
    .insert({
      granja_id: granjaId,
      codigo: producto.codigo,
      nombre: producto.nombre,
      tipo: producto.tipo,
      unidad_medida: producto.unidad,
      costo_unitario: costoUnitario > 0 ? costoUnitario : 0,
      activo: true,
    })
    .select("id, costo_unitario")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: created.id,
    costo_unitario: Number(created.costo_unitario),
  };
}

export type SyncAlimInput = {
  granjaId: string;
  gastoId: string;
  fecha: string;
  monto: number;
  /** Kg/sacos reales del PDF o captura manual. Sin esto = 1 compra (lote). */
  cantidad?: number | null;
  emisorId?: string | null;
  emisorNombre?: string | null;
  concepto?: string | null;
  archivoNombre?: string | null;
  /** Texto PDF: evita mapear vet (ml) a melaza/kg. */
  texto?: string | null;
  usuarioId?: string | null;
};

/** Comida humana / personal — no entra al catálogo ni a raciones de ganado. */
export function esGastoComidaHumana(input: {
  emisorId?: string | null;
  emisorNombre?: string | null;
  concepto?: string | null;
  archivoNombre?: string | null;
}): boolean {
  const id = (input.emisorId ?? "").replace(/^0+/, "");
  const blob = `${input.emisorNombre ?? ""} ${input.concepto ?? ""} ${input.archivoNombre ?? ""}`.toLowerCase();
  return (
    id === "3101211148" ||
    blob.includes("tilapia") ||
    blob.includes("filet") ||
    blob.includes("filete") ||
    blob.includes("inversiones oso")
  );
}

/**
 * Tras confirmar un gasto ALIM: asegura catálogo + entrega (compra recibida)
 * enlazada al gasto vía observaciones (idempotente).
 */
export async function sincronizarAlimentacionDesdeGastoAlim(
  admin: SupabaseClient,
  input: SyncAlimInput
): Promise<{ alimentoId: string; alimentacionId: string; created: boolean } | null> {
  if (esGastoComidaHumana(input)) {
    return null;
  }

  const producto = resolveProductoAlim(input);
  if (!producto) {
    return null;
  }

  const marker = `gasto:${input.gastoId}`;

  const { data: existingCab } = await admin
    .from("alimentaciones")
    .select("id")
    .eq("granja_id", input.granjaId)
    .ilike("observaciones", `%${marker}%`)
    .is("deleted_at", null)
    .maybeSingle();

  const alimento = await upsertAlimento(admin, input.granjaId, producto, 0);

  // Sin kg/sacos en el PDF: 1 fila = 1 compra (lote). No inventar kg con precio de catálogo
  // (monto÷₡/kg inventaba cientos de miles de kg). Cantidad real solo si viene explícita.
  const subtotal = Math.round(input.monto * 100) / 100;
  const cantidadRaw = input.cantidad != null ? Number(input.cantidad) : NaN;
  const cantidad =
    Number.isFinite(cantidadRaw) && cantidadRaw > 0
      ? Math.round(cantidadRaw * 1000) / 1000
      : 1;
  const costoUnitario =
    cantidad > 0 ? Math.round((subtotal / cantidad) * 10000) / 10000 : subtotal;

  if (existingCab?.id) {
    const { data: existingDet } = await admin
      .from("detalle_alimentaciones")
      .select("id, cantidad")
      .eq("alimentacion_id", existingCab.id)
      .maybeSingle();
    if (!existingDet) {
      const { error: eDetFix } = await admin.from("detalle_alimentaciones").insert({
        alimentacion_id: existingCab.id,
        alimento_id: alimento.id,
        cantidad,
        costo_unitario: Math.round(costoUnitario * 10000) / 10000,
        subtotal,
      });
      if (eDetFix) throw new Error(eDetFix.message);
    } else if (
      input.cantidad != null &&
      Number(input.cantidad) > 0 &&
      Number(existingDet.cantidad) !== cantidad
    ) {
      const { error: eUp } = await admin
        .from("detalle_alimentaciones")
        .update({
          cantidad,
          costo_unitario: Math.round(costoUnitario * 10000) / 10000,
          subtotal,
        })
        .eq("id", existingDet.id);
      if (eUp) throw new Error(eUp.message);

      if (cantidad > 1 && costoUnitario > 0 && costoUnitario <= 5_000) {
        await admin
          .from("alimentos")
          .update({
            costo_unitario: costoUnitario,
            updated_at: new Date().toISOString(),
          })
          .eq("id", alimento.id);
      }
    }
    return {
      alimentoId: alimento.id,
      alimentacionId: existingCab.id,
      created: false,
    };
  }

  const loteId = await getDefaultLoteId(admin, input.granjaId);
  if (!loteId) {
    throw new Error(
      "No hay lote abierto en la granja (requerido por chk_alimentacion_destino)."
    );
  }

  const { data: cabecera, error: eCab } = await admin
    .from("alimentaciones")
    .insert({
      granja_id: input.granjaId,
      lote_id: loteId,
      fecha: input.fecha,
      costo_total: subtotal,
      observaciones: `Compra desde comprobante · ${marker} · ${producto.nombre}`,
      turno: "compra",
      created_by: input.usuarioId ?? null,
      updated_by: input.usuarioId ?? null,
    })
    .select("id")
    .single();
  if (eCab) throw new Error(eCab.message);

  const { error: eDet } = await admin.from("detalle_alimentaciones").insert({
    alimentacion_id: cabecera.id,
    alimento_id: alimento.id,
    cantidad,
    costo_unitario: Math.round(costoUnitario * 10000) / 10000,
    subtotal,
  });
  if (eDet) {
    await admin.from("alimentaciones").delete().eq("id", cabecera.id);
    throw new Error(eDet.message);
  }

  // Actualizar ₡/kg de catálogo solo con cantidad real (no 1 lote = total factura).
  if (
    input.cantidad != null &&
    Number(input.cantidad) > 1 &&
    costoUnitario > 0 &&
    costoUnitario <= 5_000
  ) {
    await admin
      .from("alimentos")
      .update({
        costo_unitario: costoUnitario,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alimento.id);
  }

  return {
    alimentoId: alimento.id,
    alimentacionId: cabecera.id,
    created: true,
  };
}
