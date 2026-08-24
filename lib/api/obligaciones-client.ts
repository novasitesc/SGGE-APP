import { parseJson } from "@/lib/api/parse-json";
import type {
  AporteCcss,
  CreateAporteCcssInput,
  CreateEmpleadoInput,
  CreatePolizaInput,
  CreatePolizaPagoInput,
  CreateSalarioInput,
  CreateServicioPublicoInput,
  CreateViaticoInput,
  Empleado,
  Poliza,
  PolizaPago,
  Salario,
  ServicioPublico,
  Viatico,
} from "@/modules/obligaciones";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return parseJson<T>(res);
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return parseJson<T>(res);
}

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar");
  }
}

export const fetchEmpleados = (all = false) =>
  getJson<Empleado[]>(all ? "/api/empleados?all=1" : "/api/empleados");
export const createEmpleadoApi = (data: CreateEmpleadoInput) =>
  sendJson<Empleado>("/api/empleados", "POST", data);
export const updateEmpleadoApi = (id: string, data: CreateEmpleadoInput) =>
  sendJson<Empleado>(`/api/empleados/${id}`, "PATCH", data);
export const deleteEmpleadoApi = (id: string) => del(`/api/empleados/${id}`);

export const fetchServiciosPublicos = () =>
  getJson<ServicioPublico[]>("/api/servicios-publicos");
export const createServicioPublicoApi = (data: CreateServicioPublicoInput) =>
  sendJson<ServicioPublico>("/api/servicios-publicos", "POST", data);
export const updateServicioPublicoApi = (id: string, data: CreateServicioPublicoInput) =>
  sendJson<ServicioPublico>(`/api/servicios-publicos/${id}`, "PATCH", data);
export const deleteServicioPublicoApi = (id: string) =>
  del(`/api/servicios-publicos/${id}`);

export const fetchPolizas = () => getJson<Poliza[]>("/api/polizas");
export const createPolizaApi = (data: CreatePolizaInput) =>
  sendJson<Poliza>("/api/polizas", "POST", data);
export const updatePolizaApi = (id: string, data: CreatePolizaInput) =>
  sendJson<Poliza>(`/api/polizas/${id}`, "PATCH", data);
export const deletePolizaApi = (id: string) => del(`/api/polizas/${id}`);
export const createPolizaPagoApi = (polizaId: string, data: CreatePolizaPagoInput) =>
  sendJson<PolizaPago>(`/api/polizas/${polizaId}/pagos`, "POST", data);
export const updatePolizaPagoApi = (id: string, data: CreatePolizaPagoInput) =>
  sendJson<PolizaPago>(`/api/poliza-pagos/${id}`, "PATCH", data);
export const deletePolizaPagoApi = (id: string) => del(`/api/poliza-pagos/${id}`);

export const fetchAportesCcss = () => getJson<AporteCcss[]>("/api/ccss");
export const createAporteCcssApi = (data: CreateAporteCcssInput) =>
  sendJson<AporteCcss>("/api/ccss", "POST", data);
export const updateAporteCcssApi = (id: string, data: CreateAporteCcssInput) =>
  sendJson<AporteCcss>(`/api/ccss/${id}`, "PATCH", data);
export const deleteAporteCcssApi = (id: string) => del(`/api/ccss/${id}`);

export const fetchSalarios = () => getJson<Salario[]>("/api/salarios");
export const createSalarioApi = (data: CreateSalarioInput) =>
  sendJson<Salario>("/api/salarios", "POST", data);
export const updateSalarioApi = (id: string, data: CreateSalarioInput) =>
  sendJson<Salario>(`/api/salarios/${id}`, "PATCH", data);
export const deleteSalarioApi = (id: string) => del(`/api/salarios/${id}`);

export const fetchViaticos = () => getJson<Viatico[]>("/api/viaticos");
export const createViaticoApi = (data: CreateViaticoInput) =>
  sendJson<Viatico>("/api/viaticos", "POST", data);
export const updateViaticoApi = (id: string, data: CreateViaticoInput) =>
  sendJson<Viatico>(`/api/viaticos/${id}`, "PATCH", data);
export const deleteViaticoApi = (id: string) => del(`/api/viaticos/${id}`);
