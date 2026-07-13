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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import {
  ChevronLeft,
  FileText,
  UploadCloud,
  Beef,
  DollarSign,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const CATEGORIAS: { code: string; label: string }[] = [
  { code: "ALIM", label: "Alimentación" },
  { code: "VET", label: "Veterinaria" },
  { code: "COMB", label: "Combustible" },
  { code: "TRANS", label: "Transporte" },
  { code: "MO", label: "Mano de obra" },
  { code: "MANT", label: "Mantenimiento / Materiales" },
  { code: "SERV", label: "Servicios profesionales" },
  { code: "OTRO", label: "Otros" },
];

const CLASS_LABEL: Record<string, string> = {
  compra_ganado: "Compra de ganado",
  gasto: "Gasto",
  pendiente: "Sin clasificar",
  ignorado: "Ignorado",
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
  classification: "gasto" | "compra_ganado";
  issuer: string;
  issuerId: string;
  issueDate: string;
  amount: string;
  categoryCode: string;
  description: string;
  totalWeightKg: string;
};

export default function ComprobantesPage() {
  const [items, setItems] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [review, setReview] = useState<Comprobante | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    setForm({
      classification: c.classification === "compra_ganado" ? "compra_ganado" : "gasto",
      issuer: c.issuer ?? "",
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
    });
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
      } else {
        payload.totalWeightKg = form.totalWeightKg ? Number(form.totalWeightKg) : null;
      }
      await confirmComprobante(review.id, payload);
      setNotice(
        form.classification === "gasto"
          ? "Gasto registrado desde el comprobante."
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
    if (filter === "todos") return items;
    return items.filter((c) => c.status === filter);
  }, [items, filter]);

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
              Sube facturas PDF → se clasifican → confírmalas como compra o gasto
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
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bandeja de comprobantes</CardTitle>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="confirmado">Confirmados</option>
            </select>
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
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay comprobantes. Sube tus primeros PDFs arriba.
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
                        ) : null}
                        {CLASS_LABEL[c.classification] ?? c.classification}
                        {c.confidence != null && c.status === "pendiente" && (
                          <span className="text-muted-foreground">({c.confidence}%)</span>
                        )}
                      </span>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Revisar comprobante
            </DialogTitle>
          </DialogHeader>
          {form && review && (
            <div className="space-y-4 mt-2">
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

              {/* Clasificación */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, classification: "compra_ganado" })}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    form.classification === "compra_ganado"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "hover:bg-muted"
                  }`}
                >
                  <Beef className="h-4 w-4" /> Compra de ganado
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="rv-issuer">Emisor / proveedor</Label>
                  <Input
                    id="rv-issuer"
                    value={form.issuer}
                    onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                    placeholder="Nombre del emisor"
                  />
                </div>
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
                    <Select
                      id="rv-cat"
                      value={form.categoryCode}
                      onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
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
                <div className="space-y-1.5">
                  <Label htmlFor="rv-desc">Concepto (opcional)</Label>
                  <Input
                    id="rv-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Se genera del emisor si se deja vacío"
                  />
                </div>
              )}

              {form.classification === "compra_ganado" &&
                (review.animales?.length ?? 0) > 0 && (
                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-3 py-2 bg-emerald-50/80 text-xs font-medium text-emerald-800">
                      {review.animales!.length} animal(es) detectado(s) en la factura
                    </div>
                    <div className="max-h-48 overflow-y-auto">
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
