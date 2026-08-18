import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseComprobanteAsync } from "@/lib/api/pdf/parse-comprobante";
import { classifyComprobante, type Clasificacion } from "@/lib/api/pdf/classify";
import { generarAnimalesDesdeCompra } from "@/lib/api/generar-animales-compra";
import {
  extractCantidadAlimentoFromText,
  sincronizarAlimentacionDesdeGastoAlim,
  type CantidadAlimDetectada,
} from "@/lib/api/alim-from-comprobante";
import {
  extractLineasVeterinarias,
  sincronizarSaludDesdeGastoVet,
  type LineaVeterinaria,
} from "@/lib/api/vet-from-comprobante";
import {
  registrarHistorial,
  snapshotVenta,
} from "@/lib/api/historial-sistema";
import {
  OBLIGACION_CODIGOS,
  sincronizarObligacionDesdeGasto,
  extractNumeroPoliza,
  extractPeriodoCcss,
  inferTipoPoliza,
  inferTipoServicioPublico,
  formatPeriodoLabel,
  type ObligacionConfirmExtras,
  type ObligacionHints,
} from "@/modules/obligaciones";

const BUCKET = "comprobantes";

export type ComprobanteRow = {
  id: string;
  archivo_nombre: string;
  archivo_path: string;
  archivo_mime: string | null;
  clave_fiscal: string | null;
  folio_fiscal: string | null;
  tipo_documento: string | null;
  emisor_nombre: string | null;
  emisor_identificacion: string | null;
  fecha_emision: string | null;
  moneda: string;
  monto_total: number | null;
  clasificacion: string;
  categoria_sugerida: string | null;
  confianza: number | null;
  estado: string;
  compra_id: string | null;
  gasto_id: string | null;
  factura_id: string | null;
  created_at: string;
  datos_parseados?: unknown;
  texto_extraido?: string | null;
};

export type ComprobanteAnimalLine = {
  codigo: string;
  tipo: string;
  color: string;
  vendedor: string;
  pesoKg: number;
  precioKg: number;
  monto: number;
};

export type ComprobanteApi = {
  id: string;
  fileName: string;
  fileUrl: string | null;
  mime: string | null;
  clave: string | null;
  folio: string | null;
  docType: string | null;
  issuer: string | null;
  issuerId: string | null;
  issueDate: string | null;
  currency: string;
  amount: number | null;
  classification: string;
  suggestedCategory: string | null;
  confidence: number | null;
  status: string;
  compraId: string | null;
  gastoId: string | null;
  facturaId: string | null;
  createdAt: string;
  animales: ComprobanteAnimalLine[];
  pesoTotalKg: number | null;
  parseReason: string | null;
  /** Cantidad ALIM sugerida desde el texto del PDF (kg/sacos). */
  cantidadAlimSugerida?: CantidadAlimDetectada | null;
  /** Líneas veterinarias detectadas en el PDF (para Salud). */
  lineasVetSugeridas?: LineaVeterinaria[] | null;
  /** Sugerencias para vincular el PDF a pólizas, CCSS, salarios, etc. */
  obligacionHints?: ObligacionHints | null;
};

export const COMPROBANTE_SELECT =
  "id, archivo_nombre, archivo_path, archivo_mime, clave_fiscal, folio_fiscal, tipo_documento, emisor_nombre, emisor_identificacion, fecha_emision, moneda, monto_total, clasificacion, categoria_sugerida, confianza, estado, compra_id, gasto_id, factura_id, created_at, datos_parseados, texto_extraido";

function extractParsedExtras(datos: unknown): {
  animales: ComprobanteAnimalLine[];
  pesoTotalKg: number | null;
  parseReason: string | null;
  cantidadAlimSugerida: CantidadAlimDetectada | null;
  lineasVetSugeridas: LineaVeterinaria[];
  texto: string | null;
} {
  const root = (datos ?? {}) as {
    parsed?: {
      animales?: ComprobanteAnimalLine[];
      pesoTotalKg?: number | null;
      texto?: string;
    };
    classification?: { motivo?: string };
    alimCantidad?: CantidadAlimDetectada | null;
  };
  const animales = Array.isArray(root.parsed?.animales) ? root.parsed!.animales! : [];
  const pesoTotalKg =
    root.parsed?.pesoTotalKg != null && Number.isFinite(Number(root.parsed.pesoTotalKg))
      ? Number(root.parsed.pesoTotalKg)
      : null;
  let cantidadAlimSugerida = root.alimCantidad ?? null;
  const texto = root.parsed?.texto ?? null;
  if (!cantidadAlimSugerida && texto) {
    cantidadAlimSugerida = extractCantidadAlimentoFromText(texto);
  }
  const lineasVetSugeridas = texto ? extractLineasVeterinarias(texto) : [];
  return {
    animales,
    pesoTotalKg,
    parseReason: root.classification?.motivo ?? null,
    cantidadAlimSugerida,
    lineasVetSugeridas,
    texto,
  };
}

export async function mapComprobanteToApi(
  admin: SupabaseClient,
  row: ComprobanteRow
): Promise<ComprobanteApi> {
  const fileUrl = await createSignedUrl(admin, row.archivo_path);
  const extras = extractParsedExtras(row.datos_parseados);
  const textoFallback = row.texto_extraido ?? extras.texto ?? "";
  const lineasVet =
    extras.lineasVetSugeridas.length > 0
      ? extras.lineasVetSugeridas
      : extractLineasVeterinarias(textoFallback);
  return {
    id: row.id,
    fileName: row.archivo_nombre,
    fileUrl,
    mime: row.archivo_mime,
    clave: row.clave_fiscal,
    folio: row.folio_fiscal,
    docType: row.tipo_documento,
    issuer: row.emisor_nombre,
    issuerId: row.emisor_identificacion,
    issueDate: row.fecha_emision,
    currency: row.moneda,
    amount: row.monto_total != null ? Number(row.monto_total) : null,
    classification: row.clasificacion,
    suggestedCategory: row.categoria_sugerida,
    confidence: row.confianza,
    status: row.estado,
    compraId: row.compra_id,
    gastoId: row.gasto_id,
    facturaId: row.factura_id,
    createdAt: row.created_at,
    animales: extras.animales,
    pesoTotalKg: extras.pesoTotalKg,
    parseReason: extras.parseReason,
    cantidadAlimSugerida: extras.cantidadAlimSugerida,
    lineasVetSugeridas: lineasVet,
    obligacionHints: buildObligacionHints(
      extras.texto || row.texto_extraido || "",
      row.emisor_nombre,
      row.fecha_emision
    ),
  };
}

function buildObligacionHints(
  texto: string,
  emisorNombre: string | null,
  fechaEmision: string | null
): ObligacionHints {
  const fecha = fechaEmision || new Date().toISOString().slice(0, 10);
  const periodo = extractPeriodoCcss(texto, fecha);
  return {
    tipoServicio: inferTipoServicioPublico(texto, emisorNombre),
    numeroPoliza: extractNumeroPoliza(texto),
    tipoPoliza: inferTipoPoliza(texto),
    periodoCcssMes: formatPeriodoLabel(periodo),
  };
}

export async function createSignedUrl(
  admin: SupabaseClient,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

export type UploadResult =
  | { ok: true; comprobante: ComprobanteApi; duplicated: boolean }
  | { ok: false; message: string; status: number };

/**
 * Sube un PDF: parsea, clasifica, guarda en Storage y crea la fila en `comprobantes`.
 * Es idempotente por clave fiscal y por hash de contenido.
 */
export async function uploadComprobante(
  admin: SupabaseClient,
  granjaId: string,
  file: { buffer: Buffer; name: string; mime: string },
  createdBy?: string
): Promise<UploadResult> {
  const hash = createHash("sha256").update(file.buffer).digest("hex");

  // Deduplicación por contenido.
  const { data: existingByHash } = await admin
    .from("comprobantes")
    .select(COMPROBANTE_SELECT)
    .eq("granja_id", granjaId)
    .eq("archivo_hash", hash)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingByHash) {
    return {
      ok: true,
      duplicated: true,
      comprobante: await mapComprobanteToApi(admin, existingByHash as ComprobanteRow),
    };
  }

  const parsed = await parseComprobanteAsync(file.buffer, file.name);
  const cls = classifyComprobante(parsed);

  // Deduplicación por clave fiscal.
  if (parsed.clave) {
    const { data: existingByClave } = await admin
      .from("comprobantes")
      .select(COMPROBANTE_SELECT)
      .eq("granja_id", granjaId)
      .eq("clave_fiscal", parsed.clave)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingByClave) {
      return {
        ok: true,
        duplicated: true,
        comprobante: await mapComprobanteToApi(admin, existingByClave as ComprobanteRow),
      };
    }
  }

  const path = `${granjaId}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file.buffer, { contentType: file.mime, upsert: false });
  if (upErr) {
    const msg = /bucket.*not.*found/i.test(upErr.message)
      ? "Bucket 'comprobantes' no existe. Ejecute docs/database/comprobantes-modulo.sql en Supabase."
      : upErr.message;
    return { ok: false, message: msg, status: 500 };
  }

  const { data: inserted, error: insErr } = await admin
    .from("comprobantes")
    .insert({
      granja_id: granjaId,
      archivo_nombre: file.name.slice(0, 255),
      archivo_path: path,
      archivo_mime: file.mime,
      archivo_hash: hash,
      clave_fiscal: parsed.clave,
      folio_fiscal: parsed.folioFiscal,
      tipo_documento: parsed.tipoDocumento,
      emisor_nombre: parsed.emisorNombre,
      emisor_identificacion: parsed.emisorIdentificacion,
      fecha_emision: parsed.fechaEmision,
      moneda: parsed.moneda,
      monto_total: parsed.montoTotal,
      clasificacion: cls.clasificacion,
      categoria_sugerida: cls.categoriaSugerida,
      confianza: cls.confianza,
      estado: "pendiente",
      texto_extraido: parsed.texto.slice(0, 20000),
      datos_parseados: {
        parsed,
        classification: cls,
        alimCantidad: extractCantidadAlimentoFromText(
          parsed.texto,
          parsed.montoTotal
        ),
      },
      created_by: createdBy ?? null,
    })
    .select(COMPROBANTE_SELECT)
    .single();

  if (insErr) {
    await admin.storage.from(BUCKET).remove([path]);
    if (insErr.code === "42P01") {
      return {
        ok: false,
        message:
          "Tabla 'comprobantes' no existe. Ejecute docs/database/comprobantes-modulo.sql en Supabase.",
        status: 503,
      };
    }
    return { ok: false, message: insErr.message, status: 400 };
  }

  return {
    ok: true,
    duplicated: false,
    comprobante: await mapComprobanteToApi(admin, inserted as ComprobanteRow),
  };
}

const PROVEEDOR_TIPO_GANADO = "ganado";

/** Busca o crea un proveedor por identificación (o razón social) del emisor. */
export async function resolveOrCreateProveedor(
  admin: SupabaseClient,
  granjaId: string,
  emisor: { nombre: string | null; identificacion: string | null; tipo?: string }
): Promise<string> {
  const razon = emisor.nombre?.trim() || "Proveedor sin nombre";
  const rfc = emisor.identificacion?.trim() || null;

  if (rfc) {
    const { data: byRfc } = await admin
      .from("proveedores")
      .select("id")
      .eq("granja_id", granjaId)
      .eq("rfc", rfc)
      .is("deleted_at", null)
      .maybeSingle();
    if (byRfc?.id) return byRfc.id;
  }

  const { data: byName } = await admin
    .from("proveedores")
    .select("id")
    .eq("granja_id", granjaId)
    .ilike("razon_social", razon)
    .is("deleted_at", null)
    .maybeSingle();
  if (byName?.id) return byName.id;

  const { data: created, error } = await admin
    .from("proveedores")
    .insert({
      granja_id: granjaId,
      razon_social: razon.slice(0, 200),
      rfc,
      tipo: emisor.tipo ?? PROVEEDOR_TIPO_GANADO,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear el proveedor: ${error.message}`);
  return created.id;
}

export type ConfirmInput = {
  classification: Clasificacion;
  issuer?: string | null;
  issuerId?: string | null;
  issueDate?: string | null;
  amount?: number | null;
  // Para gasto
  categoryCode?: string | null;
  description?: string | null;
  /** Kg/und reales de la compra ALIM (manual o sugerido del PDF). */
  cantidadAlim?: number | null;
  /** Datos de negocio al vincular el PDF a SPUB/POL/CCSS/SAL/VIAT. */
  obligacion?: ObligacionConfirmExtras | null;
  // Para compra de ganado
  totalWeightKg?: number | null;
  tipoAdquisicion?: "subasta" | "particular" | "contrato";
  // Para venta (factura emitida por la granja)
  buyer?: string | null;
};

export type ConfirmResult =
  | { ok: true; comprobante: ComprobanteApi }
  | { ok: false; message: string; status: number };

/** Confirma un comprobante: crea la compra o el gasto y enlaza el registro. */
export async function confirmComprobante(
  admin: SupabaseClient,
  granjaId: string,
  comprobanteId: string,
  input: ConfirmInput
): Promise<ConfirmResult> {
  const { data: rowRaw, error: e0 } = await admin
    .from("comprobantes")
    .select(COMPROBANTE_SELECT)
    .eq("granja_id", granjaId)
    .eq("id", comprobanteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (e0) return { ok: false, message: e0.message, status: 500 };
  if (!rowRaw) return { ok: false, message: "Comprobante no encontrado.", status: 404 };

  const row = rowRaw as ComprobanteRow;
  if (row.estado === "confirmado") {
    return { ok: false, message: "El comprobante ya fue confirmado.", status: 409 };
  }

  const issuer = input.issuer ?? row.emisor_nombre;
  const issuerId = input.issuerId ?? row.emisor_identificacion;
  const issueDate = input.issueDate ?? row.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const amount = input.amount ?? (row.monto_total != null ? Number(row.monto_total) : null);

  // No aplicable (factura propia sin venta, o mensaje de aceptación que duplica
  // una factura ya contabilizada): se marca 'ignorar' y se saca de la bandeja.
  if (input.classification === "ignorar") {
    const { data: updated, error } = await admin
      .from("comprobantes")
      .update({
        deleted_at: new Date().toISOString(),
        emisor_nombre: issuer ?? row.emisor_nombre,
        emisor_identificacion: issuerId ?? row.emisor_identificacion,
        fecha_emision: issueDate,
        monto_total: amount != null && amount > 0 ? amount : row.monto_total,
        clasificacion: "ignorar",
      })
      .eq("id", row.id)
      .select(COMPROBANTE_SELECT)
      .single();
    if (error) return { ok: false, message: error.message, status: 400 };
    return { ok: true, comprobante: await mapComprobanteToApi(admin, updated as ComprobanteRow) };
  }

  if (amount == null || amount <= 0) {
    return { ok: false, message: "El monto total debe ser mayor a 0.", status: 400 };
  }

  if (input.classification === "gasto") {
    return confirmarComoGasto(admin, granjaId, row, {
      issueDate,
      amount,
      issuer,
      categoryCode: input.categoryCode ?? row.categoria_sugerida ?? "OTRO",
      description: input.description,
      cantidadAlim: input.cantidadAlim ?? null,
      obligacion: input.obligacion ?? null,
    });
  }

  if (input.classification === "compra_ganado") {
    return confirmarComoCompra(admin, granjaId, row, {
      issueDate,
      amount,
      issuer,
      issuerId,
      totalWeightKg: input.totalWeightKg ?? null,
      tipoAdquisicion: input.tipoAdquisicion ?? "subasta",
    });
  }

  if (input.classification === "venta") {
    return confirmarComoVenta(admin, granjaId, row, {
      issueDate,
      amount,
      issuer,
      buyer: input.buyer ?? null,
      totalWeightKg: input.totalWeightKg ?? null,
      description: input.description,
    });
  }

  return { ok: false, message: "Clasificación inválida para confirmar.", status: 400 };
}

/** Busca o crea un cliente por razón social (comprador de la factura de venta). */
async function resolveOrCreateCliente(
  admin: SupabaseClient,
  granjaId: string,
  buyer: string
): Promise<string> {
  const razon = buyer.trim() || "Cliente sin nombre";
  const { data: existing } = await admin
    .from("clientes")
    .select("id")
    .eq("granja_id", granjaId)
    .ilike("razon_social", razon)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from("clientes")
    .insert({
      granja_id: granjaId,
      razon_social: razon.slice(0, 200),
      canal_venta: "nacional",
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`);
  return created.id;
}

async function confirmarComoGasto(
  admin: SupabaseClient,
  granjaId: string,
  row: ComprobanteRow,
  data: {
    issueDate: string;
    amount: number;
    issuer: string | null;
    categoryCode: string;
    description?: string | null;
    cantidadAlim?: number | null;
    obligacion?: ObligacionConfirmExtras | null;
  }
): Promise<ConfirmResult> {
  const { data: categoria, error: eCat } = await admin
    .from("categorias_gastos")
    .select("id")
    .eq("codigo", data.categoryCode.toUpperCase())
    .maybeSingle();
  if (eCat) return { ok: false, message: eCat.message, status: 500 };
  if (!categoria) {
    return { ok: false, message: `Categoría '${data.categoryCode}' no existe.`, status: 400 };
  }

  const concepto =
    data.description?.trim() ||
    `${data.issuer ?? "Comprobante"}${row.folio_fiscal ? ` — ${row.folio_fiscal}` : ""}`;

  const { data: gasto, error: eGasto } = await admin
    .from("gastos")
    .insert({
      granja_id: granjaId,
      categoria_id: categoria.id,
      fecha: data.issueDate,
      concepto: concepto.slice(0, 255),
      monto: data.amount,
      referencia: row.clave_fiscal ?? row.folio_fiscal,
    })
    .select("id")
    .single();
  if (eGasto) return { ok: false, message: eGasto.message, status: 400 };

  const extrasConfirm = extractParsedExtras(row.datos_parseados);
  const textoPdf = extrasConfirm.texto || row.texto_extraido || "";

  // Compras ALIM de ganado → catálogo + alimentaciones (no comida humana / tilapia / vet-ml).
  if (data.categoryCode.toUpperCase() === "ALIM") {
    try {
      const cantidad =
        data.cantidadAlim != null && Number(data.cantidadAlim) > 0
          ? Number(data.cantidadAlim)
          : null;

      await sincronizarAlimentacionDesdeGastoAlim(admin, {
        granjaId,
        gastoId: gasto.id,
        fecha: data.issueDate,
        monto: data.amount,
        cantidad,
        emisorId: row.emisor_identificacion,
        emisorNombre: data.issuer ?? row.emisor_nombre,
        concepto,
        archivoNombre: row.archivo_nombre,
        texto: textoPdf,
      });
    } catch {
      // El gasto ya quedó; la sync se puede reintentar con el script de backfill.
    }
  }

  // Insumos veterinarios → catálogo medicamentos + tratamientos (Salud).
  // Unidades: ml / dosis / und (NO kg). Corre si categoría VET o hay líneas vet en el PDF.
  {
    const lineasVet =
      extrasConfirm.lineasVetSugeridas.length > 0
        ? extrasConfirm.lineasVetSugeridas
        : extractLineasVeterinarias(textoPdf);
    const isVet = data.categoryCode.toUpperCase() === "VET";
    if (isVet || lineasVet.length > 0) {
      try {
        await sincronizarSaludDesdeGastoVet(admin, {
          granjaId,
          gastoId: gasto.id,
          fecha: data.issueDate,
          monto: data.amount,
          texto: textoPdf,
          concepto,
          archivoNombre: row.archivo_nombre,
          fallbackTotal: isVet && lineasVet.length === 0,
        });
      } catch {
        // El gasto ya quedó; reintentar con scripts/backfill-vet-salud.ts
      }
    }
  }

  const catCode = data.categoryCode.toUpperCase();
  if ((OBLIGACION_CODIGOS as readonly string[]).includes(catCode)) {
    try {
      await sincronizarObligacionDesdeGasto(admin, catCode, {
        granjaId,
        gastoId: gasto.id,
        fecha: data.issueDate,
        monto: data.amount,
        concepto,
        emisorNombre: data.issuer ?? row.emisor_nombre,
        comprobanteId: row.id,
        texto: textoPdf,
        tipoServicio: data.obligacion?.tipoServicio,
        numeroCuenta: data.obligacion?.numeroCuenta,
        periodoInicio: data.obligacion?.periodoInicio,
        periodoFin: data.obligacion?.periodoFin,
        numeroPoliza: data.obligacion?.numeroPoliza,
        tipoPoliza: data.obligacion?.tipoPoliza,
        polizaId: data.obligacion?.polizaId,
        periodoCcss: data.obligacion?.periodoCcss,
        tipoAporte: data.obligacion?.tipoAporte,
        empleadoId: data.obligacion?.empleadoId,
        empleadoNombre: data.obligacion?.empleadoNombre,
        tipoSalario: data.obligacion?.tipoSalario,
        destino: data.obligacion?.destino,
        motivo: data.obligacion?.motivo,
      });
    } catch {
      // El gasto ya quedó; completar la sección a mano si hace falta.
    }
  }

  const updated = await finalizeComprobante(admin, row.id, {
    clasificacion: "gasto",
    categoria_sugerida: data.categoryCode.toUpperCase(),
    gasto_id: gasto.id,
    monto_total: data.amount,
    fecha_emision: data.issueDate,
    emisor_nombre: data.issuer,
  });
  return updated;
}

async function confirmarComoCompra(
  admin: SupabaseClient,
  granjaId: string,
  row: ComprobanteRow,
  data: {
    issueDate: string;
    amount: number;
    issuer: string | null;
    issuerId: string | null;
    totalWeightKg: number | null;
    tipoAdquisicion: "subasta" | "particular" | "contrato";
  }
): Promise<ConfirmResult> {
  let proveedorId: string;
  try {
    proveedorId = await resolveOrCreateProveedor(admin, granjaId, {
      nombre: data.issuer,
      identificacion: data.issuerId,
      tipo: "ganado",
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Error con proveedor", status: 400 };
  }

  const extras = extractParsedExtras(row.datos_parseados);
  const animales = extras.animales;
  const pesoFromLines =
    animales.length > 0
      ? Math.round(animales.reduce((s, a) => s + Number(a.pesoKg), 0) * 100) / 100
      : null;
  const pesoTotalKg = data.totalWeightKg ?? extras.pesoTotalKg ?? pesoFromLines ?? 0;

  const folio = row.folio_fiscal ?? row.clave_fiscal ?? `COMP-${row.id.slice(0, 8)}`;
  const obsParts = [`Alta desde comprobante ${row.archivo_nombre}`];
  if (animales.length > 0) {
    obsParts.push(`${animales.length} animal(es) en detalle_compras.`);
  }

  const { data: compra, error: eCompra } = await admin
    .from("compras_animales")
    .insert({
      granja_id: granjaId,
      proveedor_id: proveedorId,
      folio: folio.slice(0, 50),
      fecha_compra: data.issueDate,
      tipo_adquisicion: data.tipoAdquisicion,
      peso_total_kg: pesoTotalKg,
      monto_total: data.amount,
      observaciones: obsParts.join(" "),
    })
    .select("id")
    .single();
  if (eCompra) {
    if (eCompra.code === "23505") {
      return { ok: false, message: "Ya existe una compra con ese folio.", status: 409 };
    }
    return { ok: false, message: eCompra.message, status: 400 };
  }

  type DetalleInsert = {
    compra_id: string;
    arete_referencia: string | null;
    peso_compra_kg: number;
    precio_kg: number;
    subtotal: number;
    lote_subasta: string | null;
  };
  const detalles: DetalleInsert[] = [];

  if (animales.length > 0) {
    for (const a of animales) {
      const codigo = String(a.codigo ?? "").trim();
      const tipo = String(a.tipo ?? "").trim();
      const color = String(a.color ?? "").trim();
      const ref = [`NO${codigo}`, tipo, color].filter(Boolean).join(" ").slice(0, 50);
      detalles.push({
        compra_id: compra.id,
        arete_referencia: ref || null,
        peso_compra_kg: Number(a.pesoKg),
        precio_kg: Number(a.precioKg),
        subtotal: Number(a.monto),
        lote_subasta: codigo ? codigo.slice(0, 30) : null,
      });
    }
  } else if (pesoTotalKg > 0) {
    const precioKg = Math.round((data.amount / pesoTotalKg) * 10000) / 10000;
    detalles.push({
      compra_id: compra.id,
      arete_referencia: (data.issuer ?? "TORO").slice(0, 50),
      peso_compra_kg: pesoTotalKg,
      precio_kg: precioKg,
      subtotal: data.amount,
      lote_subasta: null,
    });
  }

  if (detalles.length > 0) {
    const invalid = detalles.find(
      (d) =>
        !Number.isFinite(d.peso_compra_kg) ||
        d.peso_compra_kg <= 0 ||
        !Number.isFinite(d.precio_kg) ||
        d.precio_kg < 0 ||
        !Number.isFinite(d.subtotal)
    );
    if (invalid) {
      await admin.from("compras_animales").delete().eq("id", compra.id);
      return {
        ok: false,
        message: "Líneas de animales inválidas (peso/precio/monto).",
        status: 400,
      };
    }
    const { error: eDet } = await admin.from("detalle_compras").insert(detalles);
    if (eDet) {
      await admin.from("compras_animales").delete().eq("id", compra.id);
      return { ok: false, message: eDet.message, status: 400 };
    }
  }

  const { data: factura, error: eFact } = await admin
    .from("facturas")
    .insert({
      compra_id: compra.id,
      tipo: "egreso",
      folio_fiscal: row.folio_fiscal,
      uuid_fiscal: row.clave_fiscal?.slice(0, 36) ?? null,
      fecha_emision: data.issueDate,
      monto: data.amount,
      archivo_url: row.archivo_path,
    })
    .select("id")
    .single();
  if (eFact) {
    if (detalles.length > 0) {
      await admin.from("detalle_compras").delete().eq("compra_id", compra.id);
    }
    await admin.from("compras_animales").delete().eq("id", compra.id);
    return { ok: false, message: eFact.message, status: 400 };
  }

  if (detalles.length > 0) {
    await generarAnimalesDesdeCompra(admin, granjaId, compra.id, {
      fechaIngreso: data.issueDate,
    }).catch(() => null);
  }

  return finalizeComprobante(admin, row.id, {
    clasificacion: "compra_ganado",
    compra_id: compra.id,
    factura_id: factura.id,
    monto_total: data.amount,
    fecha_emision: data.issueDate,
  });
}

async function confirmarComoVenta(
  admin: SupabaseClient,
  granjaId: string,
  row: ComprobanteRow,
  data: {
    issueDate: string;
    amount: number;
    issuer: string | null;
    buyer: string | null;
    totalWeightKg: number | null;
    description?: string | null;
  }
): Promise<ConfirmResult> {
  // El comprador puede no venir legible en el PDF; usamos un cliente genérico.
  const comprador = data.buyer?.trim() || "Cliente (comprobante)";
  let clienteId: string;
  try {
    clienteId = await resolveOrCreateCliente(admin, granjaId, comprador);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Error con cliente", status: 400 };
  }

  const folio = row.folio_fiscal ?? row.clave_fiscal ?? `VTA-${row.id.slice(0, 8)}`;
  const pesoTotalKg = data.totalWeightKg != null && data.totalWeightKg > 0 ? data.totalWeightKg : 0;
  const observaciones =
    data.description?.trim() || `Venta desde comprobante ${row.archivo_nombre}`;

  const { data: venta, error: eVenta } = await admin
    .from("ventas")
    .insert({
      granja_id: granjaId,
      cliente_id: clienteId,
      folio: folio.slice(0, 50),
      fecha_venta: data.issueDate,
      canal_venta: "nacional",
      peso_total_kg: pesoTotalKg,
      monto_total: data.amount,
      observaciones: observaciones.slice(0, 500),
    })
    .select("id")
    .single();
  if (eVenta) {
    if (eVenta.code === "23505") {
      return { ok: false, message: "Ya existe una venta con ese folio.", status: 409 };
    }
    return { ok: false, message: eVenta.message, status: 400 };
  }

  const { data: factura, error: eFact } = await admin
    .from("facturas")
    .insert({
      venta_id: venta.id,
      tipo: "ingreso",
      folio_fiscal: row.folio_fiscal,
      uuid_fiscal: row.clave_fiscal?.slice(0, 36) ?? null,
      fecha_emision: data.issueDate,
      monto: data.amount,
      archivo_url: row.archivo_path,
    })
    .select("id")
    .single();
  if (eFact) {
    await admin.from("ventas").delete().eq("id", venta.id);
    return { ok: false, message: eFact.message, status: 400 };
  }

  await registrarHistorial(admin, {
    granjaId,
    modulo: "ventas",
    registroId: venta.id,
    referencia: folio.slice(0, 50),
    accion: "crear",
    resumen: `Venta desde comprobante ${row.archivo_nombre}: ₡${data.amount} — ${comprador}.`,
    datosNuevos: snapshotVenta({
      arete: "—",
      comprador,
      pesoKg: pesoTotalKg,
      precioKg:
        pesoTotalKg > 0 ? Math.round((data.amount / pesoTotalKg) * 100) / 100 : 0,
      total: data.amount,
      fecha: data.issueDate,
      folio: folio.slice(0, 50),
    }),
  });

  return finalizeComprobante(admin, row.id, {
    clasificacion: "venta",
    factura_id: factura.id,
    monto_total: data.amount,
    fecha_emision: data.issueDate,
    emisor_nombre: data.issuer,
  });
}

async function finalizeComprobante(
  admin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>
): Promise<ConfirmResult> {
  const { data, error } = await admin
    .from("comprobantes")
    .update({ ...patch, estado: "confirmado" })
    .eq("id", id)
    .select(COMPROBANTE_SELECT)
    .single();
  if (error) return { ok: false, message: error.message, status: 400 };
  return { ok: true, comprobante: await mapComprobanteToApi(admin, data as ComprobanteRow) };
}
