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

/** Intenta leer kg/sacos del texto del PDF (heurística; el usuario puede corregir). */
export function extractCantidadAlimentoFromText(
  texto: string,
  montoTotal?: number | null
): CantidadAlimDetectada | null {
  if (!texto?.trim()) return null;
  const compact = texto.replace(/\s+/g, " ");
  const monto = montoTotal != null ? Number(montoTotal) : null;

  const parseNum = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const normalized = t.includes(",") && t.includes(".")
      ? t.replace(/,/g, "")
      : t.includes(",")
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  type Cand = CantidadAlimDetectada & { score: number };
  const cands: Cand[] = [];

  const push = (
    raw: string,
    unidad: CantidadAlimDetectada["unidad"],
    fuente: string,
    score: number
  ) => {
    const n = parseNum(raw);
    if (n == null || n > 500_000) return;
    // Evitar confundir el total de la factura con una cantidad.
    if (monto != null && Math.abs(n - monto) < 0.02) return;
    if (unidad === "kg" && n < 1) return;
    cands.push({ cantidad: n, unidad, fuente: fuente.slice(0, 48), score });
  };

  const labeledKg =
    /(?:cantidad|cant\.?|peso|kilos?)\s*[:.]?\s*([\d.,]+)\s*(?:kg|kgs|kilos?)?\b/gi;
  let m: RegExpExecArray | null;
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
 * No inventa raciones diarias: representa la compra recibida como entrega.
 */
export function resolveProductoAlim(input: {
  emisorId?: string | null;
  emisorNombre?: string | null;
  concepto?: string | null;
  archivoNombre?: string | null;
}): ProductoAlim {
  const id = (input.emisorId ?? "").replace(/^0+/, "");
  const blob = `${input.emisorNombre ?? ""} ${input.concepto ?? ""} ${input.archivoNombre ?? ""}`.toLowerCase();

  if (id === "3101383363" || blob.includes("avin") || blob.includes("maíz") || blob.includes("maiz")) {
    return {
      codigo: "MAIZ-AVIN",
      nombre: "Maíz molido (AVIN)",
      tipo: "concentrado",
      unidad: "kg",
    };
  }

  if (
    id === "3004045002" ||
    blob.includes("dos pinos") ||
    blob.includes("melaza") ||
    blob.includes("grofactor")
  ) {
    if (blob.includes("grofactor")) {
      return {
        codigo: "GRO-DP",
        nombre: "Grofactor / concentrado Dos Pinos",
        tipo: "concentrado",
        unidad: "kg",
      };
    }
    return {
      codigo: "MEL-DP",
      nombre: "Melaza Dos Pinos",
      tipo: "melaza",
      unidad: "kg",
    };
  }

  if (id === "3102007223" || blob.includes("super mercados") || blob.includes("walmart")) {
    return {
      codigo: "SUP-ALIM",
      nombre: "Insumos supermercado",
      tipo: "otro",
      unidad: "und",
    };
  }

  if (blob.includes("vitamina") || blob.includes("mineral")) {
    return {
      codigo: "VIT-MIN",
      nombre: "Vitaminas / minerales",
      tipo: "suplemento",
      unidad: "kg",
    };
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

  const marker = `gasto:${input.gastoId}`;

  const { data: existingCab } = await admin
    .from("alimentaciones")
    .select("id")
    .eq("granja_id", input.granjaId)
    .ilike("observaciones", `%${marker}%`)
    .is("deleted_at", null)
    .maybeSingle();

  const producto = resolveProductoAlim(input);
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
