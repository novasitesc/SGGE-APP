"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Plus, Shield, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import {
  createPolizaApi,
  createPolizaPagoApi,
  deletePolizaApi,
  deletePolizaPagoApi,
  fetchPolizas,
  updatePolizaApi,
} from "@/lib/api/obligaciones-client";
import {
  ESTADO_POLIZA_LABEL,
  ESTADOS_POLIZA,
  TIPO_POLIZA_LABEL,
  TIPOS_POLIZA,
  type EstadoPoliza,
  type TipoPoliza,
} from "@/modules/obligaciones";
import { GestionObligacionLayout } from "@/modules/obligaciones/components/GestionObligacionLayout";

const today = () => new Date().toISOString().slice(0, 10);

export default function GestionPolizasPage() {
  const { data, loading, error, reload } = useApiQuery("polizas", fetchPolizas);
  const polizas = data ?? [];
  const [polizaOpen, setPolizaOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pagoPolizaId, setPagoPolizaId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletePolizaId, setDeletePolizaId] = useState<string | null>(null);
  const [deletePagoId, setDeletePagoId] = useState<string | null>(null);

  const [pForm, setPForm] = useState({
    aseguradora: "INS",
    numeroPoliza: "",
    tipo: "riesgos_trabajo" as TipoPoliza,
    vigenciaDesde: "",
    vigenciaHasta: "",
    primaTotal: "",
    estado: "vigente" as EstadoPoliza,
    notas: "",
  });
  const [pagoForm, setPagoForm] = useState({
    fecha: today(),
    monto: "",
    periodoDesde: "",
    periodoHasta: "",
    concepto: "",
  });

  const pagos = useMemo(() => polizas.flatMap((p) => p.pagos), [polizas]);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  const todayIso = today();
  const vigentes = polizas.filter(
    (p) => p.estado === "vigente" && (!p.vigenciaHasta || p.vigenciaHasta >= todayIso)
  ).length;
  const vencidas = polizas.filter(
    (p) => p.estado === "vencida" || (p.vigenciaHasta && p.vigenciaHasta < todayIso)
  ).length;
  const proxima = polizas
    .filter((p) => p.vigenciaHasta && p.vigenciaHasta >= todayIso)
    .sort((a, b) => (a.vigenciaHasta ?? "").localeCompare(b.vigenciaHasta ?? ""))[0];

  const refresh = async () => {
    invalidateApiCacheMany(["polizas", "costs", "dashboard"]);
    await reload();
  };

  const openNewPoliza = () => {
    setEditingId(null);
    setPForm({
      aseguradora: "INS",
      numeroPoliza: "",
      tipo: "riesgos_trabajo",
      vigenciaDesde: "",
      vigenciaHasta: "",
      primaTotal: "",
      estado: "vigente",
      notas: "",
    });
    setFormError(null);
    setPolizaOpen(true);
  };

  const savePoliza = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        aseguradora: pForm.aseguradora.trim() || "INS",
        numeroPoliza: pForm.numeroPoliza.trim(),
        tipo: pForm.tipo,
        vigenciaDesde: pForm.vigenciaDesde || null,
        vigenciaHasta: pForm.vigenciaHasta || null,
        primaTotal: pForm.primaTotal ? Number(pForm.primaTotal) : null,
        estado: pForm.estado,
        notas: pForm.notas.trim() || null,
      };
      if (editingId) await updatePolizaApi(editingId, payload);
      else await createPolizaApi(payload);
      await refresh();
      setPolizaOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const savePago = async () => {
    if (!pagoPolizaId) return;
    setSaving(true);
    setFormError(null);
    try {
      await createPolizaPagoApi(pagoPolizaId, {
        fecha: pagoForm.fecha,
        monto: Number(pagoForm.monto),
        periodoDesde: pagoForm.periodoDesde || null,
        periodoHasta: pagoForm.periodoHasta || null,
        concepto: pagoForm.concepto.trim() || null,
      });
      await refresh();
      setPagoOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GestionObligacionLayout
      title="Pólizas"
      description="INS y otras aseguradoras · catálogo y pagos de prima"
      icon={Shield}
      iconClass="text-indigo-700"
      error={error}
      extraActions={
        <button
          type="button"
          onClick={openNewPoliza}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          Nueva póliza
        </button>
      }
      kpis={[
        { label: "Pagos registrados", value: formatCurrency(totalPagos) },
        { label: "Vigentes", value: String(vigentes) },
        { label: "Vencidas", value: String(vencidas), alert: vencidas > 0 },
        {
          label: "Próxima a vencer",
          value: proxima?.numeroPoliza ?? "—",
          hint: proxima?.vigenciaHasta ? formatDate(proxima.vigenciaHasta) : undefined,
        },
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading && polizas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : polizas.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No hay pólizas. Registre el número INS (p. ej. Riesgos del Trabajo) para
              luego anotar cada pago.
            </CardContent>
          </Card>
        ) : (
          polizas.map((p) => {
            const vencida =
              p.estado === "vencida" ||
              (!!p.vigenciaHasta && p.vigenciaHasta < todayIso);
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {p.aseguradora} · {p.numeroPoliza}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TIPO_POLIZA_LABEL[p.tipo]}
                      {p.vigenciaDesde && p.vigenciaHasta
                        ? ` · ${formatDate(p.vigenciaDesde)} – ${formatDate(p.vigenciaHasta)}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={vencida ? "warning" : "success"}>
                    {vencida ? "Vencida" : ESTADO_POLIZA_LABEL[p.estado]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    Pagado:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(p.totalPagado)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({p.pagosCount} {p.pagosCount === 1 ? "pago" : "pagos"})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-sm rounded-lg border px-3 py-1.5 hover:bg-muted"
                      onClick={() => {
                        setPagoPolizaId(p.id);
                        setPagoForm({
                          fecha: today(),
                          monto: "",
                          periodoDesde: p.vigenciaDesde ?? "",
                          periodoHasta: p.vigenciaHasta ?? "",
                          concepto: "",
                        });
                        setFormError(null);
                        setPagoOpen(true);
                      }}
                    >
                      Registrar pago
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-muted"
                      onClick={() => {
                        setEditingId(p.id);
                        setPForm({
                          aseguradora: p.aseguradora,
                          numeroPoliza: p.numeroPoliza,
                          tipo: p.tipo,
                          vigenciaDesde: p.vigenciaDesde ?? "",
                          vigenciaHasta: p.vigenciaHasta ?? "",
                          primaTotal: p.primaTotal != null ? String(p.primaTotal) : "",
                          estado: p.estado,
                          notas: p.notas ?? "",
                        });
                        setPolizaOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                      onClick={() => setDeletePolizaId(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Póliza</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Sin pagos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                pagos.map((pago) => {
                  const pol = polizas.find((x) => x.id === pago.polizaId);
                  return (
                    <TableRow key={pago.id}>
                      <TableCell>
                        {pol ? `${pol.aseguradora} ${pol.numeroPoliza}` : "—"}
                      </TableCell>
                      <TableCell>{pago.concepto}</TableCell>
                      <TableCell>{formatDate(pago.fecha)}</TableCell>
                      <TableCell>
                        {pago.origen === "comprobante" ? (
                          <Badge variant="info" className="gap-1">
                            <FileText className="h-3 w-3" />
                            Factura
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(pago.monto)}
                      </TableCell>
                      <TableCell className="text-right">
                        {pago.comprobanteId && (
                          <Link href="/gestion/comprobantes" className="p-1.5 inline-flex hover:bg-muted rounded-lg">
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                          onClick={() => setDeletePagoId(pago.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={polizaOpen} onOpenChange={setPolizaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar póliza" : "Nueva póliza"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Aseguradora</Label>
              <Input
                value={pForm.aseguradora}
                onChange={(e) => setPForm({ ...pForm, aseguradora: e.target.value })}
              />
            </div>
            <div>
              <Label>Número de póliza</Label>
              <Input
                value={pForm.numeroPoliza}
                onChange={(e) => setPForm({ ...pForm, numeroPoliza: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={pForm.tipo}
                onChange={(e) => setPForm({ ...pForm, tipo: e.target.value as TipoPoliza })}
              >
                {TIPOS_POLIZA.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_POLIZA_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={pForm.estado}
                onChange={(e) => setPForm({ ...pForm, estado: e.target.value as EstadoPoliza })}
              >
                {ESTADOS_POLIZA.map((t) => (
                  <option key={t} value={t}>
                    {ESTADO_POLIZA_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Vigencia desde</Label>
              <Input
                type="date"
                value={pForm.vigenciaDesde}
                onChange={(e) => setPForm({ ...pForm, vigenciaDesde: e.target.value })}
              />
            </div>
            <div>
              <Label>Vigencia hasta</Label>
              <Input
                type="date"
                value={pForm.vigenciaHasta}
                onChange={(e) => setPForm({ ...pForm, vigenciaHasta: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notas</Label>
              <Input
                value={pForm.notas}
                onChange={(e) => setPForm({ ...pForm, notas: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePoliza()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium"
            >
              Guardar póliza
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago de prima</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={pagoForm.fecha}
                onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Monto (₡)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
              />
            </div>
            <div>
              <Label>Período cubierto desde</Label>
              <Input
                type="date"
                value={pagoForm.periodoDesde}
                onChange={(e) => setPagoForm({ ...pagoForm, periodoDesde: e.target.value })}
              />
            </div>
            <div>
              <Label>Período cubierto hasta</Label>
              <Input
                type="date"
                value={pagoForm.periodoHasta}
                onChange={(e) => setPagoForm({ ...pagoForm, periodoHasta: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Concepto (opcional)</Label>
              <Input
                value={pagoForm.concepto}
                onChange={(e) => setPagoForm({ ...pagoForm, concepto: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePago()}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium"
            >
              Guardar pago
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePolizaId} onOpenChange={() => setDeletePolizaId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar póliza</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se anulan la póliza y todos sus pagos (y los gastos en Costos).
          </p>
          <DialogFooter>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setDeletePolizaId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm"
              onClick={async () => {
                if (!deletePolizaId) return;
                await deletePolizaApi(deletePolizaId);
                await refresh();
                setDeletePolizaId(null);
              }}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePagoId} onOpenChange={() => setDeletePagoId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar pago</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">También se anula el gasto en Costos.</p>
          <DialogFooter>
            <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setDeletePagoId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm"
              onClick={async () => {
                if (!deletePagoId) return;
                await deletePolizaPagoApi(deletePagoId);
                await refresh();
                setDeletePagoId(null);
              }}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GestionObligacionLayout>
  );
}
