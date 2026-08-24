"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  OBLIGACION_CODIGOS,
  TIPO_APORTE_CCSS_LABEL,
  TIPO_POLIZA_LABEL,
  TIPO_SALARIO_LABEL,
  TIPO_SERVICIO_LABEL,
  TIPOS_APORTE_CCSS,
  TIPOS_POLIZA,
  TIPOS_SALARIO,
  TIPOS_SERVICIO_PUBLICO,
  type Empleado,
  type ObligacionConfirmExtras,
  type Poliza,
} from "../types/obligaciones.types";
import { destinoPorCategoria } from "../lib/destinos";

export type ObligacionFormValues = {
  tipoServicio: string;
  numeroCuenta: string;
  periodoInicio: string;
  periodoFin: string;
  polizaId: string;
  numeroPoliza: string;
  tipoPoliza: string;
  periodoCcss: string;
  tipoAporte: string;
  empleadoId: string;
  empleadoNombre: string;
  tipoSalario: string;
  destino: string;
  motivo: string;
};

export const EMPTY_OBLIGACION_FORM: ObligacionFormValues = {
  tipoServicio: "otro",
  numeroCuenta: "",
  periodoInicio: "",
  periodoFin: "",
  polizaId: "",
  numeroPoliza: "",
  tipoPoliza: "otro",
  periodoCcss: "",
  tipoAporte: "cuota_obrero_patronal",
  empleadoId: "",
  empleadoNombre: "",
  tipoSalario: "ordinario",
  destino: "",
  motivo: "",
};

function empleadoLabel(e: Empleado): string {
  return [e.nombre, e.apellido].filter(Boolean).join(" ").trim() || e.id;
}

export function ObligacionReviewFields({
  categoryCode,
  values,
  onChange,
  polizas,
  empleados,
}: {
  categoryCode: string;
  values: ObligacionFormValues;
  onChange: (patch: Partial<ObligacionFormValues>) => void;
  polizas: Poliza[];
  empleados: Empleado[];
}) {
  const code = categoryCode.toUpperCase();
  if (!(OBLIGACION_CODIGOS as readonly string[]).includes(code)) return null;

  const dest = destinoPorCategoria(code);
  const title = dest?.label ?? "Obligación";

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <p className="text-sm font-medium text-sky-900">
        Vincular a {title}
      </p>
      <p className="text-xs text-muted-foreground">
        Al confirmar, el gasto queda en Costos y se registra también en esta
        sección para administrarlo con su ficha (cuenta, póliza, empleado, etc.).
      </p>

      {code === "SPUB" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rv-spub-tipo">Tipo de servicio</Label>
            <Select
              id="rv-spub-tipo"
              value={values.tipoServicio}
              onChange={(e) => onChange({ tipoServicio: e.target.value })}
            >
              {TIPOS_SERVICIO_PUBLICO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_SERVICIO_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-spub-nis">NIS / número de cuenta</Label>
            <Input
              id="rv-spub-nis"
              value={values.numeroCuenta}
              onChange={(e) => onChange({ numeroCuenta: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-spub-ini">Periodo desde</Label>
            <Input
              id="rv-spub-ini"
              type="date"
              value={values.periodoInicio}
              onChange={(e) => onChange({ periodoInicio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-spub-fin">Periodo hasta</Label>
            <Input
              id="rv-spub-fin"
              type="date"
              value={values.periodoFin}
              onChange={(e) => onChange({ periodoFin: e.target.value })}
            />
          </div>
        </div>
      )}

      {code === "POL" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rv-pol-exist">Póliza existente</Label>
            <Select
              id="rv-pol-exist"
              value={values.polizaId}
              onChange={(e) => {
                const polizaId = e.target.value;
                const found = polizas.find((p) => p.id === polizaId);
                onChange({
                  polizaId,
                  numeroPoliza: found?.numeroPoliza ?? values.numeroPoliza,
                  tipoPoliza: found?.tipo ?? values.tipoPoliza,
                });
              }}
            >
              <option value="">Nueva póliza (indicar número abajo)</option>
              {polizas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numeroPoliza} · {p.aseguradora} · {TIPO_POLIZA_LABEL[p.tipo]}
                </option>
              ))}
            </Select>
          </div>
          {!values.polizaId && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-pol-num">Número de póliza</Label>
              <Input
                id="rv-pol-num"
                value={values.numeroPoliza}
                onChange={(e) => onChange({ numeroPoliza: e.target.value })}
                placeholder="Ej. 0101234567"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rv-pol-tipo">Tipo de cobertura</Label>
            <Select
              id="rv-pol-tipo"
              value={values.tipoPoliza}
              onChange={(e) => onChange({ tipoPoliza: e.target.value })}
              disabled={Boolean(values.polizaId)}
            >
              {TIPOS_POLIZA.map((t) => (
                <option key={t} value={t}>
                  {TIPO_POLIZA_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {code === "CCSS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rv-ccss-per">Periodo de planilla</Label>
            <Input
              id="rv-ccss-per"
              type="month"
              value={values.periodoCcss}
              onChange={(e) => onChange({ periodoCcss: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-ccss-tipo">Tipo de aporte</Label>
            <Select
              id="rv-ccss-tipo"
              value={values.tipoAporte}
              onChange={(e) => onChange({ tipoAporte: e.target.value })}
            >
              {TIPOS_APORTE_CCSS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_APORTE_CCSS_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {(code === "SAL" || code === "VIAT") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rv-emp">Empleado</Label>
            <Select
              id="rv-emp"
              value={values.empleadoId}
              onChange={(e) => {
                const empleadoId = e.target.value;
                const found = empleados.find((x) => x.id === empleadoId);
                onChange({
                  empleadoId,
                  empleadoNombre: found ? empleadoLabel(found) : values.empleadoNombre,
                });
              }}
            >
              <option value="">Nombre libre (abajo)</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {empleadoLabel(e)}
                  {e.puesto ? ` · ${e.puesto}` : ""}
                </option>
              ))}
            </Select>
          </div>
          {!values.empleadoId && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-emp-nom">Nombre</Label>
              <Input
                id="rv-emp-nom"
                value={values.empleadoNombre}
                onChange={(e) => onChange({ empleadoNombre: e.target.value })}
                placeholder={code === "SAL" ? "Planilla / colaborador" : "Quién viajó"}
              />
            </div>
          )}
          {code === "SAL" && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-sal-tipo">Tipo de pago</Label>
              <Select
                id="rv-sal-tipo"
                value={values.tipoSalario}
                onChange={(e) => onChange({ tipoSalario: e.target.value })}
              >
                {TIPOS_SALARIO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_SALARIO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {code === "VIAT" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rv-viat-dest">Destino *</Label>
                <Input
                  id="rv-viat-dest"
                  value={values.destino}
                  onChange={(e) => onChange({ destino: e.target.value })}
                  placeholder="Ej. San José, subasta"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rv-viat-mot">Motivo</Label>
                <Input
                  id="rv-viat-mot"
                  value={values.motivo}
                  onChange={(e) => onChange({ motivo: e.target.value })}
                  placeholder="Gestión, feria, trámite…"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function toObligacionConfirmExtras(
  categoryCode: string,
  values: ObligacionFormValues
): ObligacionConfirmExtras | null {
  const code = categoryCode.toUpperCase();
  if (!(OBLIGACION_CODIGOS as readonly string[]).includes(code)) return null;
  if (code === "SPUB") {
    return {
      tipoServicio: values.tipoServicio,
      numeroCuenta: values.numeroCuenta.trim() || null,
      periodoInicio: values.periodoInicio || null,
      periodoFin: values.periodoFin || null,
    };
  }
  if (code === "POL") {
    return {
      polizaId: values.polizaId || null,
      numeroPoliza: values.numeroPoliza.trim() || null,
      tipoPoliza: values.tipoPoliza,
    };
  }
  if (code === "CCSS") {
    return {
      periodoCcss: values.periodoCcss || null,
      tipoAporte: values.tipoAporte,
    };
  }
  if (code === "SAL") {
    return {
      empleadoId: values.empleadoId || null,
      empleadoNombre: values.empleadoNombre.trim() || null,
      tipoSalario: values.tipoSalario,
    };
  }
  return {
    empleadoId: values.empleadoId || null,
    empleadoNombre: values.empleadoNombre.trim() || null,
    destino: values.destino.trim() || null,
    motivo: values.motivo.trim() || null,
  };
}
