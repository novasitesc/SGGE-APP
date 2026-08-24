import { parseJson } from "@/lib/api/parse-json";
import type { BodegaCompra, CreateBodegaCompraInput } from "@/modules/bodega";

export async function fetchBodegaCompras(): Promise<BodegaCompra[]> {
  const res = await fetch("/api/bodega", { cache: "no-store" });
  return parseJson<BodegaCompra[]>(res);
}

export async function createBodegaCompraApi(
  data: CreateBodegaCompraInput
): Promise<BodegaCompra> {
  const res = await fetch("/api/bodega", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<BodegaCompra>(res);
}

export async function updateBodegaCompraApi(
  id: string,
  data: CreateBodegaCompraInput
): Promise<BodegaCompra> {
  const res = await fetch(`/api/bodega/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<BodegaCompra>(res);
}

export async function deleteBodegaCompraApi(id: string): Promise<void> {
  const res = await fetch(`/api/bodega/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar");
  }
}
