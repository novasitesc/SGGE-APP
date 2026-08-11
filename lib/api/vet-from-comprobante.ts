import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarHistorial } from "@/lib/api/historial-sistema";
import { unidadDesdeNombreProducto } from "@/lib/api/unidades-medida";
import type { TreatmentType } from "@/lib/types/domain";

export type LineaVeterinaria = {
  codigo: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  tipo: TreatmentType | string;
  /** ml | dosis | und — nunca forzar kg. */
  unidad: string;
};

/** Productos veterinarios conocidos (Dos Pinos y genéricos). Marca/principio. */
const VET_NAME =
  /PARTOVET|BAYTRIL|HISTAMINEX|CARBOLINA|IVERMECT|ALBENDAZ|DESPARASIT|VACUN|ANTIBIOT|OXITETRA|PENICIL|DORAMEC|MOXIDECT|LEVAMISOL|FENBENDAZ|FLUNIXIN|BANAMINE|CEFTIOFUR|CLOSTRID|BOVIGAM|COVEXIN|DRAXXIN|CYDECTIN|BAYCOX|SULFADIM|RUMENSIN|MONENSIN|ANTIPARASIT|MEDICAMENT|VETERINAR|REVALOR|VIRBAMEC|ABAXTION|MULTIFORT|\bABZ\b|COSMO\s*IN|BAYOVAC|CATTLEMASTER|TRIANGLE|SPIROVET|OXITOCIN|DEXAMET|FLUMETASON|ENROFLOX|TILMICOS|FLORFENIC/i;

/** No son tratamientos (inventario / ferretería / alimento). */
const EXCLUDE_NAME =
  /ARETE|ALLFLEX|PVC|UNION\s+LISA|TORNILLO|TUBERIA|TUBERÍA|ACEITE\s+HU|MELAZA|GROFACTOR|MA[IÍ]Z|CONCENTRAD|ALAMBRE|AISLADOR|CLAVO|GRAPA|ALICATE|BATERIA|TIJERA/i;

const LINE_RE =
  /(\d{7,8})\s*[-–]\s*([A-ZÁÉÍÓÚÑ0-9 /.%]+?)\s+(\d+(?:[.,]\d+)?)\s+([\d,]+\.\d{2})\s+[A-Z]\s+([\d,]+\.\d{2})/gi;

function parseMoney(s: string): number {
  return Number(s.replace(/,/g, ""));
}

export function classifyTipoMedicamento(nombre: string): TreatmentType | string {
  const n = nombre.toLowerCase();
  if (/vacun|bovigam|covexin|clostrid|aftosa|brucel/.test(n)) return "vacuna";
  if (
    /desparasit|ivermect|albendaz|doramec|moxidect|fenbendaz|levamisol|cydectin|virbamec|abaxtion|\babz\b/.test(
      n
    )
  )
    return "desparasitante";
  if (
    /baytril|antibiot|antibiótico|oxitetra|penicil|ceftiofur|draxxin|sulfadim|enroflox|tilmicos|florfenic/.test(
      n
    )
  )
    return "antibiótico";
  if (/vitamin|biotina|mineral|multifort/.test(n)) return "vitamina";
  if (/implant|revalor/.test(n)) return "implante";
  if (/anabol/.test(n)) return "anabólico";
  // Partovet / Histaminex / Carbolina → tratamiento genérico tipo antibiótico/soporte
  if (/partovet|histaminex|carbolina|baycox|flunixin|banamine|cosmo/.test(n))
    return "antibiótico";
  return "vacuna";
}

/** Extrae líneas veterinarias del texto de factura (heurística Dos Pinos / similar). */
export function extractLineasVeterinarias(texto: string): LineaVeterinaria[] {
  if (!texto?.trim()) return [];
  const lines: LineaVeterinaria[] = [];
  const seen = new Set<string>();

  LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINE_RE.exec(texto)) !== null) {
    const nombre = m[2].trim().replace(/\s+/g, " ");
    if (EXCLUDE_NAME.test(nombre)) continue;
    if (!VET_NAME.test(nombre)) continue;
    const key = `${m[1]}|${nombre}|${m[5]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cantidad = Number(String(m[3]).replace(",", ".")) || 1;
    const precioUnitario = parseMoney(m[4]);
    const total = parseMoney(m[5]);
    lines.push({
      codigo: m[1],
      nombre,
      cantidad: cantidad > 0 ? cantidad : 1,
      precioUnitario,
      total,
      tipo: classifyTipoMedicamento(nombre),
      unidad: unidadDesdeNombreProducto(nombre),
    });
  }

  // Fallback: nombres sueltos sin estructura de línea completa
  if (lines.length === 0 && VET_NAME.test(texto)) {
    const named = texto.match(
      /\d{7,8}\s*[-–]\s*[A-ZÁÉÍÓÚÑ0-9 /.%]*(?:PARTOVET|BAYTRIL|HISTAMINEX|CARBOLINA|IVERMECT|VACUN|DRAXXIN|CYDECTIN|REVALOR|VIRBAMEC|ABAXTION|MULTIFORT|DORAMEC)[A-ZÁÉÍÓÚÑ0-9 /.%]*/gi
    );
    for (const raw of named ?? []) {
      const nombre = raw.replace(/^\d{7,8}\s*[-–]\s*/, "").trim();
      if (EXCLUDE_NAME.test(nombre) || seen.has(nombre)) continue;
      seen.add(nombre);
      lines.push({
        codigo: raw.slice(0, 8),
        nombre,
        cantidad: 1,
        precioUnitario: 0,
        total: 0,
        tipo: classifyTipoMedicamento(nombre),
        unidad: unidadDesdeNombreProducto(nombre),
      });
    }
  }

  return lines;
}

export function tieneIndiciosVeterinarios(texto: string): boolean {
  if (!texto?.trim()) return false;
  if (extractLineasVeterinarias(texto).length > 0) return true;
  return (
    VET_NAME.test(texto) &&
    !EXCLUDE_NAME.test(texto.replace(VET_NAME, ""))
  );
}

function codigoMedicamento(nombre: string, codigoPdf?: string | null): string {
  if (codigoPdf) return `DP-${codigoPdf}`;
  const slug = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 12)
    .toUpperCase();
  return `MED-${slug || "GEN"}`;
}

async function upsertMedicamento(
  admin: SupabaseClient,
  granjaId: string,
  line: LineaVeterinaria
): Promise<string> {
  const codigo = codigoMedicamento(line.nombre, line.codigo);

  const { data: byCode } = await admin
    .from("medicamentos")
    .select("id")
    .eq("granja_id", granjaId)
    .eq("codigo", codigo)
    .is("deleted_at", null)
    .maybeSingle();

  if (byCode?.id) {
    if (line.precioUnitario > 0) {
      await admin
        .from("medicamentos")
        .update({
          costo_unitario: line.precioUnitario,
          updated_at: new Date().toISOString(),
          activo: true,
        })
        .eq("id", byCode.id);
    }
    return byCode.id as string;
  }

  const { data: byName } = await admin
    .from("medicamentos")
    .select("id")
    .eq("granja_id", granjaId)
    .ilike("nombre", line.nombre)
    .is("deleted_at", null)
    .maybeSingle();
  if (byName?.id) {
    if (line.precioUnitario > 0) {
      await admin
        .from("medicamentos")
        .update({
          costo_unitario: line.precioUnitario,
          codigo,
          updated_at: new Date().toISOString(),
          activo: true,
        })
        .eq("id", byName.id);
    }
    return byName.id as string;
  }

  const { data: created, error } = await admin
    .from("medicamentos")
    .insert({
      granja_id: granjaId,
      codigo,
      nombre: line.nombre,
      tipo: line.tipo,
      unidad_medida: line.unidad || unidadDesdeNombreProducto(line.nombre),
      costo_unitario: line.precioUnitario || line.total || 0,
      activo: true,
    })
    .select("id")
    .single();

  if (error) {
    // Schema legado sin granja_id
    const retry = await admin
      .from("medicamentos")
      .insert({
        nombre: line.nombre,
        tipo: line.tipo,
      })
      .select("id")
      .single();
    if (retry.error) throw new Error(error.message);
    return retry.data.id as string;
  }
  return created.id as string;
}

export type SyncVetInput = {
  granjaId: string;
  gastoId: string;
  fecha: string;
  monto: number;
  texto?: string | null;
  concepto?: string | null;
  archivoNombre?: string | null;
  usuarioId?: string | null;
  /** Si true y no hay líneas parseadas, crea un tratamiento con el total del gasto. */
  fallbackTotal?: boolean;
};

export type SyncVetResult = {
  created: number;
  skipped: number;
  tratamientoIds: string[];
  medicamentoIds: string[];
  lineas: LineaVeterinaria[];
};

/**
 * Tras confirmar gasto con líneas VET: upsert catálogo + tratamientos (compra).
 * Idempotente vía marcador `gasto:{id}` + nombre en observaciones.
 */
export async function sincronizarSaludDesdeGastoVet(
  admin: SupabaseClient,
  input: SyncVetInput
): Promise<SyncVetResult> {
  const marker = `gasto:${input.gastoId}`;
  let lineas = extractLineasVeterinarias(input.texto ?? "");

  if (lineas.length === 0 && input.fallbackTotal) {
    const nombre = (input.concepto ?? "Insumo veterinario").slice(0, 80);
    lineas = [
      {
        codigo: null,
        nombre,
        cantidad: 1,
        precioUnitario: input.monto,
        total: input.monto,
        tipo: classifyTipoMedicamento(input.concepto ?? ""),
        unidad: unidadDesdeNombreProducto(nombre),
      },
    ];
  }

  if (lineas.length === 0) {
    return {
      created: 0,
      skipped: 0,
      tratamientoIds: [],
      medicamentoIds: [],
      lineas: [],
    };
  }

  const tratamientoIds: string[] = [];
  const medicamentoIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const line of lineas) {
    const lineMarker = `${marker} · ${line.nombre}`;

    const { data: existing } = await admin
      .from("tratamientos")
      .select("id")
      .eq("granja_id", input.granjaId)
      .ilike("observaciones", `%${marker}%`)
      .ilike("observaciones", `%${line.nombre}%`)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing?.id) {
      skipped += 1;
      tratamientoIds.push(existing.id);
      continue;
    }

    // Fallback sin granja_id
    const { data: existingLegacy } = await admin
      .from("tratamientos")
      .select("id")
      .ilike("observaciones", `%${lineMarker}%`)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingLegacy?.id) {
      skipped += 1;
      tratamientoIds.push(existingLegacy.id);
      continue;
    }

    const medicamentoId = await upsertMedicamento(admin, input.granjaId, line);
    medicamentoIds.push(medicamentoId);

    const total =
      line.total > 0
        ? line.total
        : Math.round(line.precioUnitario * line.cantidad * 100) / 100;
    const costPerAnimal = total; // compra de stock: 1 “aplicación” de lote

    const insertRow: Record<string, unknown> = {
      granja_id: input.granjaId,
      medicamento_id: medicamentoId,
      tipo: line.tipo,
      nombre: line.nombre,
      fecha_inicio: input.fecha,
      animal_count: 1,
      costo_por_animal: costPerAnimal,
      costo_total: total,
      estado: "comprado",
      aplicado_por: "",
      observaciones: `Compra desde comprobante · ${lineMarker}`,
      origen: "pdf",
      created_by: input.usuarioId ?? null,
    };

    const inserted = await admin
      .from("tratamientos")
      .insert(insertRow)
      .select("id")
      .single();
    const { error } = inserted;
    let row = inserted.data;

    if (error) {
      const retry = await admin
        .from("tratamientos")
        .insert({
          medicamento_id: medicamentoId,
          fecha_inicio: input.fecha,
          costo_total: total,
          estado: "comprado",
          observaciones: `Compra desde comprobante · ${lineMarker}`,
        })
        .select("id")
        .single();
      if (retry.error) throw new Error(error.message);
      row = retry.data;
    }

    if (row?.id) {
      tratamientoIds.push(row.id);
      created += 1;
      await registrarHistorial(admin, {
        granjaId: input.granjaId,
        modulo: "salud",
        registroId: row.id,
        referencia: line.nombre,
        accion: "crear",
        resumen: `Medicamento desde comprobante: ${line.nombre} — ₡${total}.`,
        datosNuevos: {
          gastoId: input.gastoId,
          medicamentoId,
          total,
          origen: "pdf",
        },
        usuarioId: input.usuarioId,
      });
    }
  }

  return { created, skipped, tratamientoIds, medicamentoIds, lineas };
}
