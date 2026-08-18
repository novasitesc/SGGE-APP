"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchComprobantes,
  uploadComprobantes,
  confirmComprobante,
  deleteComprobante,
  type Comprobante,
  type ConfirmPayload,
} from "@/lib/api/comprobantes-client";
import { fetchEmpleados, fetchPolizas } from "@/lib/api/obligaciones-client";
import {
  OBLIGACION_CODIGOS,
  destinoPorCategoria,
  type Empleado,
  type Poliza,
} from "@/modules/obligaciones";
import {
  EMPTY_OBLIGACION_FORM,
  ObligacionReviewFields,
  toObligacionConfirmExtras,
  type ObligacionFormValues,
} from "@/modules/obligaciones/components/ObligacionReviewFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DownwardSelect } from "@/components/ui/downward-select";
import {
  etiquetaFactura,
  folioCorto,
  isValidEmisorNombre,
} from "@/lib/api/pdf/extract-emisor";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CEDULA_GRANJA } from "@/lib/api/pdf/emisores-conocidos";
import {
  ChevronLeft,
  FileText,
  UploadCloud,
  Beef,
  DollarSign,
  TrendingUp,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Search,
  X,
  Shield,
  Zap,
  Landmark,
  Wallet,
  MapPin,
  HeartPulse,
  Wheat,
} from "lucide-react";

const CATEGORIAS_OPERACION: { code: string; label: string }[] = [
  { code: "ALIM", label: "Alimentación" },
  { code: "VET", label: "Veterinaria" },
  { code: "COMB", label: "Combustible" },
  { code: "TRANS", label: "Transporte" },
  { code: "MO", label: "Mano de obra (jornales)" },
  { code: "MANT", label: "Mantenimiento / Materiales" },
  { code: "SERV", label: "Servicios profesionales" },
  { code: "OTRO", label: "Otros" },
];

const CATEGORIAS_OBLIGACION: { code: string; label: string }[] = [
  { code: "SPUB", label: "Servicios públicos" },
  { code: "POL", label: "Pólizas" },
  { code: "CCSS", label: "CCSS" },
  { code: "SAL", label: "Salarios" },
  { code: "VIAT", label: "Viáticos" },
];

const CLASS_LABEL: Record<string, string> = {
  compra_ganado: "Compra de ganado",
  gasto: "Gasto",
  venta: "Venta",
  pendiente: "Sin clasificar",
  ignorar: "Ignorado",
};

const DOC_LABEL: Record<string, string> = {
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
  tiquete: "Tiquete",
  factura_compra: "Factura de compra",
  factura_exportacion: "Factura de exportación",
};

type ReviewForm = {
  classification: "gasto" | "compra_ganado" | "venta";
  issuer: string;
  issuerId: string;
  issueDate: string;
  amount: string;
  categoryCode: string;
  description: string;
  totalWeightKg: string;
  buyer: string;
  /** Cantidad ALIM en kg (o und). Vacío = 1 compra/lote. */
  cantidadAlim: string;
  cantidadAlimHint: string;
  obligacion: ObligacionFormValues;
};

function hintsToObligacionForm(
  c: Comprobante
): ObligacionFormValues {
  const h = c.obligacionHints;
  const mes = h?.periodoCcssMes && /^\d{4}-\d{2}$/.test(h.periodoCcssMes)
    ? h.periodoCcssMes
    : (c.issueDate ?? "").slice(0, 7);
  return {
    ...EMPTY_OBLIGACION_FORM,
    tipoServicio: h?.tipoServicio ?? "otro",
    numeroPoliza: h?.numeroPoliza ?? "",
    tipoPoliza: h?.tipoPoliza ?? "otro",
    periodoCcss: mes,
  };
}

function DestinoLink({
  href,
  label,
  icon: Icon,
  className,
}: {
  href: string;
  label: string;
  icon: typeof DollarSign;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

const DESTINO_ICON: Record<string, typeof DollarSign> = {
  SPUB: Zap,
  POL: Shield,
  CCSS: Landmark,
  SAL: Wallet,
  VIAT: MapPin,
  ALIM: Wheat,
  VET: HeartPulse,
};

const DESTINO_COLOR: Record<string, string> = {
  SPUB: "text-sky-700",
  POL: "text-violet-700",
  CCSS: "text-teal-700",
  SAL: "text-blue-700",
  VIAT: "text-purple-700",
  ALIM: "text-lime-700",
  VET: "text-rose-700",
};

export default function ComprobantesPage() {
  const [items, setItems] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [review, setReview] = useState<Comprobante | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchComprobantes();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await uploadComprobantes(Array.from(files));
      const okCount = res.results.filter((r) => r.ok && !r.duplicated).length;
      const dupCount = res.results.filter((r) => r.duplicated).length;
      const failCount = res.results.filter((r) => !r.ok).length;
      const parts: string[] = [];
      if (okCount) parts.push(`${okCount} subido(s)`);
      if (dupCount) parts.push(`${dupCount} duplicado(s) omitido(s)`);
      if (failCount) parts.push(`${failCount} con error`);
      setNotice(parts.join(" · ") || "Sin cambios");
      const firstError = res.results.find((r) => !r.ok)?.error;
      if (firstError && okCount === 0 && dupCount === 0) setError(firstError);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir archivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openReview = (c: Comprobante) => {
    setReview(c);
    const isPropia =
      c.issuerId === CEDULA_GRANJA ||
      (c.fileName ?? "").includes(CEDULA_GRANJA) ||
      (c.fileName ?? "").includes("003101029993");
    const cls: ReviewForm["classification"] =
      c.classification === "compra_ganado"
        ? "compra_ganado"
        : c.classification === "venta" || isPropia
          ? "venta"
          : "gasto";
    const sug = c.cantidadAlimSugerida;
    const isAlim = (c.suggestedCategory ?? "").toUpperCase() === "ALIM";
    let cantidadAlim = "";
    let cantidadAlimHint = "";
    if (sug) {
      if (sug.unidad === "kg") {
        cantidadAlim = String(sug.cantidad);
        cantidadAlimHint = `Detectado en PDF: ${sug.cantidad} kg («${sug.fuente}»). Puedes corregirlo.`;
      } else if (sug.unidad === "saco") {
        cantidadAlimHint = `PDF menciona ${sug.cantidad} saco(s) («${sug.fuente}»). Indica el total en kg.`;
      } else {
        cantidadAlim = String(sug.cantidad);
        cantidadAlimHint = `Detectado en PDF: ${sug.cantidad} und («${sug.fuente}»).`;
      }
    } else if (isAlim) {
      cantidadAlimHint =
        "Opcional: kg o unidades recibidas. Si lo dejas vacío se registra como 1 compra (sin ₡/kg).";
    }
    const issuerRaw = (c.issuer ?? "").trim();
    const nFactura = folioCorto(c.folio, null);
    const issuer = isValidEmisorNombre(issuerRaw)
      ? issuerRaw
      : nFactura
        ? etiquetaFactura(nFactura)
        : issuerRaw;
    setForm({
      classification: cls,
      issuer,
      issuerId: c.issuerId ?? "",
      issueDate: c.issueDate ?? new Date().toISOString().slice(0, 10),
      amount: c.amount != null ? String(c.amount) : "",
      categoryCode: c.suggestedCategory ?? "OTRO",
      description: "",
      totalWeightKg:
        c.pesoTotalKg != null
          ? String(c.pesoTotalKg)
          : c.animales?.length
            ? String(
                Math.round(
                  c.animales.reduce((s, a) => s + a.pesoKg, 0) * 100
                ) / 100
              )
            : "",
      buyer: "",
      cantidadAlim,
      cantidadAlimHint,
      obligacion: hintsToObligacionForm(c),
    });
    void Promise.all([fetchPolizas(), fetchEmpleados()]).then(
      ([p, e]) => {
        setPolizas(p);
        setEmpleados(e);
      },
      () => {
        /* catálogos opcionales: el usuario puede escribir a mano */
      }
    );
  };

  const submitReview = async () => {
    if (!review || !form) return;
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ConfirmPayload = {
        classification: form.classification,
        issuer: form.issuer.trim() || null,
        issuerId: form.issuerId.trim() || null,
        issueDate: form.issueDate,
        amount: amountNum,
      };
      if (form.classification === "gasto") {
        payload.categoryCode = form.categoryCode;
        payload.description = form.description.trim() || null;
        if (form.categoryCode.toUpperCase() === "ALIM" && form.cantidadAlim.trim()) {
          const q = Number(form.cantidadAlim);
          if (!Number.isFinite(q) || q <= 0) {
            setError("La cantidad ALIM debe ser mayor a 0.");
            setSaving(false);
            return;
          }
          payload.cantidadAlim = q;
        }
        const cat = form.categoryCode.toUpperCase();
        if ((OBLIGACION_CODIGOS as readonly string[]).includes(cat)) {
          if (cat === "POL" && !form.obligacion.polizaId && !form.obligacion.numeroPoliza.trim()) {
            setError("Indica el número de póliza o elige una existente.");
            setSaving(false);
            return;
          }
          if (cat === "VIAT" && !form.obligacion.destino.trim()) {
            setError("Indica el destino del viático.");
            setSaving(false);
            return;
          }
          payload.obligacion = toObligacionConfirmExtras(cat, form.obligacion);
        }
      } else if (form.classification === "venta") {
        payload.buyer = form.buyer.trim() || null;
        payload.totalWeightKg = form.totalWeightKg ? Number(form.totalWeightKg) : null;
        payload.description = form.description.trim() || null;
      } else {
        payload.totalWeightKg = form.totalWeightKg ? Number(form.totalWeightKg) : null;
      }
      await confirmComprobante(review.id, payload);
      const vetN = review.lineasVetSugeridas?.length ?? 0;
      const dest = destinoPorCategoria(form.categoryCode);
      const gastoMsg =
        dest
          ? `Gasto registrado y vinculado a ${dest.label}.`
          : vetN > 0
            ? `Gasto registrado. ${vetN} línea(s) veterinaria(s) inscritas en Salud.`
            : form.categoryCode.toUpperCase() === "VET"
              ? "Gasto veterinario registrado e inscrito en Salud."
              : "Gasto registrado desde el comprobante.";
      setNotice(
        form.classification === "gasto"
          ? gastoMsg
          : form.classification === "venta"
            ? "Venta registrada desde el comprobante."
            : (review.animales?.length ?? 0) > 0
              ? `Compra registrada con ${review.animales!.length} animal(es) en detalle.`
              : "Compra de ganado registrada desde el comprobante."
      );
      setReview(null);
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteComprobante(deleteId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== "todos" && c.status !== filter) return false;
      if (classFilter !== "todos" && c.classification !== classFilter) {
        return false;
      }
      if (
        categoryFilter !== "todos" &&
        (c.suggestedCategory ?? "") !== categoryFilter
      ) {
        return false;
      }
      if (dateFrom && (c.issueDate ?? "") < dateFrom) return false;
      if (dateTo && (c.issueDate ?? "") > dateTo) return false;
      if (!q) return true;
      const haystack = [
        c.fileName,
        c.issuer,
        c.issuerId,
        c.folio,
        c.clave,
        c.docType,
        CLASS_LABEL[c.classification] ?? c.classification,
        c.suggestedCategory,
        c.amount != null ? String(c.amount) : "",
        c.amount != null ? formatCurrency(c.amount) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, filter, search, classFilter, categoryFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    filter !== "todos" ||
    search.trim() !== "" ||
    classFilter !== "todos" ||
    categoryFilter !== "todos" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setFilter("todos");
    setSearch("");
    setClassFilter("todos");
    setCategoryFilter("todos");
    setDateFrom("");
    setDateTo("");
  };

  const stats = useMemo(() => {
    const pend = items.filter((c) => c.status === "pendiente").length;
    const conf = items.filter((c) => c.status === "confirmado").length;
    const total = items.reduce((s, c) => s + (c.amount ?? 0), 0);
    return { pend, conf, total };
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/gestion"
            className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              <h1 className="text-2xl font-bold tracking-tight">Comprobantes</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Las facturas confirmadas alimentan Costos, Animales o Ventas · PDF → clasificar → confirmar
            </p>
          </div>
        </div>
      </div>

      {/* Upload dropzone */}
      <Card>
        <CardContent className="pt-6">
          <label
            htmlFor="comprobante-file"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/40 px-6 py-10 text-center cursor-pointer hover:bg-sky-50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 text-sky-600 animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8 text-sky-600" />
            )}
            <p className="text-sm font-medium text-foreground">
              {uploading ? "Procesando archivos…" : "Arrastra PDFs aquí o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, PNG o JPG · hasta 20 MB · varios a la vez
            </p>
            <input
              id="comprobante-file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
          {notice && (
            <p className="mt-3 text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {notice}
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{stats.pend}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-muted-foreground">Confirmados</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{stats.conf}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium text-muted-foreground">Monto total</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{formatCurrency(stats.total)}</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Bandeja de comprobantes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading
                  ? "Cargando…"
                  : `${filtered.length} de ${items.length} PDF(s)`}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar archivo, emisor, folio, monto…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Buscar comprobantes"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="confirmado">Confirmados</option>
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filtrar por clasificación"
            >
              <option value="todos">Toda clasificación</option>
              <option value="gasto">Gasto</option>
              <option value="compra_ganado">Compra de ganado</option>
              <option value="venta">Venta</option>
              <option value="pendiente">Sin clasificar</option>
              <option value="ignorar">Ignorado</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filtrar por categoría"
            >
              <option value="todos">Toda categoría</option>
              <optgroup label="Operación">
                {CATEGORIAS_OPERACION.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Obligaciones">
                {CATEGORIAS_OBLIGACION.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Fecha desde"
                title="Fecha desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Fecha hasta"
                title="Fecha hasta"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Archivo</TableHead>
                <TableHead>Emisor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Clasificación</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {items.length === 0
                      ? "No hay comprobantes. Sube tus primeros PDFs arriba."
                      : "Sin resultados para los filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate text-sm" title={c.fileName}>
                          {c.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      <span className="truncate block" title={c.issuer ?? ""}>
                        {c.issuer ?? "—"}
                      </span>
                      {c.issuerId && (
                        <span className="text-xs text-muted-foreground">{c.issuerId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.docType ? DOC_LABEL[c.docType] ?? c.docType : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs">
                        {c.classification === "compra_ganado" ? (
                          <Beef className="h-3.5 w-3.5 text-emerald-600" />
                        ) : c.classification === "gasto" ? (
                          <DollarSign className="h-3.5 w-3.5 text-orange-600" />
                        ) : c.classification === "venta" ? (
                          <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
                        ) : null}
                        {CLASS_LABEL[c.classification] ?? c.classification}
                        {c.confidence != null && c.status === "pendiente" && (
                          <span className="text-muted-foreground">({c.confidence}%)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.status === "confirmado" && c.gastoId ? (
                        (() => {
                          const dest = destinoPorCategoria(c.suggestedCategory);
                          if (dest) {
                            const code = (c.suggestedCategory ?? "").toUpperCase();
                            return (
                              <DestinoLink
                                href={dest.href}
                                label={dest.label}
                                icon={DESTINO_ICON[code] ?? DollarSign}
                                className={DESTINO_COLOR[code] ?? "text-orange-700"}
                              />
                            );
                          }
                          return (
                            <DestinoLink
                              href="/gestion/costos"
                              label="Costos"
                              icon={DollarSign}
                              className="text-orange-700"
                            />
                          );
                        })()
                      ) : c.status === "confirmado" && c.compraId ? (
                        <DestinoLink
                          href="/gestion/animales"
                          label="Animales"
                          icon={Beef}
                          className="text-emerald-700"
                        />
                      ) : c.status === "confirmado" && c.classification === "venta" ? (
                        <DestinoLink
                          href="/gestion/ventas"
                          label="Ventas"
                          icon={TrendingUp}
                          className="text-sky-700"
                        />
                      ) : c.status === "confirmado" ? (
                        <span className="text-xs text-muted-foreground">Confirmado</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendiente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.issueDate ? formatDate(c.issueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {c.amount != null ? formatCurrency(c.amount) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.status === "confirmado" ? (
                        <Badge variant="success">Confirmado</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.fileUrl && (
                          <a
                            href={c.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Ver PDF"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {c.status === "pendiente" && (
                          <>
                            <button
                              onClick={() => openReview(c)}
                              className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                            >
                              Revisar
                            </button>
                            <button
                              onClick={() => setDeleteId(c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={review !== null} onOpenChange={(o) => !o && (setReview(null), setForm(null))}>
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Revisar comprobante
            </DialogTitle>
          </DialogHeader>
          {form && review && (
            <div className="mt-1 space-y-3">
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-xs truncate" title={review.fileName}>
                    {review.fileName}
                  </span>
                  {review.fileUrl && (
                    <a
                      href={review.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 shrink-0"
                    >
                      Ver PDF <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {review.parseReason && (
                  <p className="text-xs text-muted-foreground">
                    {review.parseReason}
                    {review.confidence != null ? ` · confianza ${review.confidence}%` : ""}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, classification: "compra_ganado" })}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.classification === "compra_ganado"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Beef className="h-4 w-4" /> Compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, classification: "gasto" })}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.classification === "gasto"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "hover:bg-muted"
                    }`}
                  >
                    <DollarSign className="h-4 w-4" /> Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, classification: "venta" })}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.classification === "venta"
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "hover:bg-muted"
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" /> Venta
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rv-issuer">Emisor / proveedor</Label>
                    <Input
                      id="rv-issuer"
                      value={form.issuer}
                      onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                      placeholder="Nombre del emisor o n.º de factura"
                    />
                    {/^Factura\s+\d+/i.test(form.issuer) && (
                      <p className="text-xs text-amber-700">
                        No se leyó un nombre de emisor confiable. Quedó el número de
                        factura; corrígelo si lo reconoces.
                      </p>
                    )}
                  </div>

                  {form.classification === "venta" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rv-buyer">Cliente / comprador</Label>
                      <Input
                        id="rv-buyer"
                        value={form.buyer}
                        onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                        placeholder="Se usa 'Cliente (comprobante)' si se deja vacío"
                      />
                    </div>
                  )}

                  {(form.classification === "gasto" || form.classification === "venta") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rv-desc">Concepto (opcional)</Label>
                      <Input
                        id="rv-desc"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder={
                          form.classification === "venta"
                            ? "Detalle de la venta (opcional)"
                            : "Se genera del emisor si se deja vacío"
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rv-issuerid">Identificación</Label>
                    <Input
                      id="rv-issuerid"
                      value={form.issuerId}
                      onChange={(e) => setForm({ ...form, issuerId: e.target.value })}
                      placeholder="Cédula"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rv-date">Fecha *</Label>
                    <Input
                      id="rv-date"
                      type="date"
                      value={form.issueDate}
                      onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rv-amount">Monto total (₡) *</Label>
                    <Input
                      id="rv-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  {form.classification === "gasto" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="rv-cat">Categoría</Label>
                      <DownwardSelect
                        id="rv-cat"
                        value={form.categoryCode}
                        onValueChange={(categoryCode) => {
                          const hint =
                            categoryCode.toUpperCase() === "ALIM" && !form.cantidadAlimHint
                              ? "Opcional: kg o unidades recibidas. Si lo dejas vacío se registra como 1 compra (sin ₡/kg)."
                              : form.cantidadAlimHint;
                          setForm({ ...form, categoryCode, cantidadAlimHint: hint });
                        }}
                        groups={[
                          { label: "Operación", options: CATEGORIAS_OPERACION.map((c) => ({ value: c.code, label: c.label })) },
                          { label: "Obligaciones", options: CATEGORIAS_OBLIGACION.map((c) => ({ value: c.code, label: c.label })) },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="rv-weight">Peso total (kg)</Label>
                      <Input
                        id="rv-weight"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.totalWeightKg}
                        onChange={(e) => setForm({ ...form, totalWeightKg: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                  )}
                </div>

                {form.classification === "gasto" && (
                  <ObligacionReviewFields
                    categoryCode={form.categoryCode}
                    values={form.obligacion}
                    onChange={(patch) =>
                      setForm({
                        ...form,
                        obligacion: { ...form.obligacion, ...patch },
                      })
                    }
                    polizas={polizas}
                    empleados={empleados}
                  />
                )}

                {form.classification === "gasto" &&
                  (review.lineasVetSugeridas?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-2">
                      <p className="text-sm font-medium text-rose-900">
                        Líneas veterinarias detectadas → se inscribirán en Salud
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {review.lineasVetSugeridas!.map((l, i) => (
                          <li
                            key={`${l.codigo ?? l.nombre}-${i}`}
                            className="flex flex-wrap justify-between gap-2 border-b border-rose-100/80 pb-1 last:border-0"
                          >
                            <span>
                              <span className="font-medium">{l.nombre}</span>
                              <span className="text-xs text-muted-foreground ml-2 capitalize">
                                {l.tipo} · {l.cantidad} {l.unidad || "und"}
                              </span>
                            </span>
                            <span className="tabular-nums font-semibold">
                              {l.total > 0
                                ? `₡${l.total.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}`
                                : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        Al confirmar se crean medicamentos en Salud con su unidad
                        (ml, dosis, und) — no se convierten a kg. Aretes /
                        ferretería se omiten.
                      </p>
                    </div>
                  )}

                {form.classification === "gasto" &&
                  form.categoryCode.toUpperCase() !== "ALIM" &&
                  !(OBLIGACION_CODIGOS as readonly string[]).includes(
                    form.categoryCode.toUpperCase()
                  ) &&
                  (review.lineasVetSugeridas?.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground rounded-xl border border-dashed px-3 py-4">
                      Elige una categoría de <strong>Obligaciones</strong> para
                      vincular este PDF a servicios públicos, pólizas, CCSS,
                      salarios o viáticos. Si es un gasto operativo, confirma y
                      quedará en Costos.
                    </p>
                  )}

                {form.classification === "venta" && (
                  <p className="text-xs text-muted-foreground rounded-lg bg-sky-50/70 px-3 py-2">
                    Factura emitida por la granja. Se creará una venta + su factura de
                    ingreso en la sección <strong>Ventas</strong>. El emisor es la propia
                    granja; indica el cliente/comprador si lo conoces.
                  </p>
                )}

                {form.classification === "compra_ganado" &&
                  (review.animales?.length ?? 0) > 0 && (
                    <div className="rounded-xl border overflow-hidden">
                      <div className="px-3 py-2 bg-emerald-50/80 text-xs font-medium text-emerald-800">
                        {review.animales!.length} animal(es) detectado(s) en la factura
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0">
                            <tr className="text-left text-muted-foreground">
                              <th className="px-2 py-1.5 font-medium">Cód.</th>
                              <th className="px-2 py-1.5 font-medium">Tipo</th>
                              <th className="px-2 py-1.5 font-medium">Color</th>
                              <th className="px-2 py-1.5 font-medium text-right">kg</th>
                              <th className="px-2 py-1.5 font-medium text-right">₡/kg</th>
                              <th className="px-2 py-1.5 font-medium text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {review.animales!.map((a) => (
                              <tr key={`${a.codigo}-${a.pesoKg}-${a.monto}`} className="border-t">
                                <td className="px-2 py-1 tabular-nums">{a.codigo}</td>
                                <td className="px-2 py-1">{a.tipo}</td>
                                <td className="px-2 py-1">{a.color}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{a.pesoKg}</td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                  {a.precioKg.toLocaleString("es-CR")}
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                  {formatCurrency(a.monto)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {form.classification === "compra_ganado" && (
                  <p className="text-xs text-muted-foreground rounded-lg bg-emerald-50/60 px-3 py-2">
                    {(review.animales?.length ?? 0) > 0
                      ? `Se creará la compra (subasta) + factura de egreso + ${review.animales!.length} línea(s) en detalle_compras. Luego vinculas cada línea a un animal del inventario.`
                      : "Se creará una compra de ganado (tipo subasta) + su factura de egreso. Sin líneas de animales detectadas; el detalle se agrega luego desde inventario."}
                  </p>
                )}
              </div>
            </div>

                {form.classification === "gasto" &&
                  form.categoryCode.toUpperCase() === "ALIM" && (
                    <div className="space-y-1.5 rounded-xl border border-lime-200 bg-lime-50/50 p-3">
                      <Label htmlFor="rv-alim-qty">
                        Cantidad de alimento (kg) — melaza / maíz / concentrado
                      </Label>
                      <Input
                        id="rv-alim-qty"
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.cantidadAlim}
                        onChange={(e) =>
                          setForm({ ...form, cantidadAlim: e.target.value })
                        }
                        placeholder="Ej. 9740 kg — solo si el PDF es alimento"
                      />
                      <p className="text-xs text-muted-foreground">
                        {form.cantidadAlimHint ||
                          "No inventes kg. Productos vet (ml, CC, dosis) no van aquí: usa categoría Veterinaria."}
                      </p>
                    </div>
                  )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setReview(null);
                setForm(null);
              }}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitReview}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar y registrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Eliminar comprobante
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas eliminar este comprobante? Se borrará el archivo subido.
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={doDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
