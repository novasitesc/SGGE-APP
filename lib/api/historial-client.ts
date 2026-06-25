import type { HistorialEntry } from "@/components/animales/historial-types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Error en la solicitud");
  }
  return body as T;
}

export type HistorialListResponse = {
  items: HistorialEntry[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchHistorial(params?: {
  referencia?: string;
  arete?: string;
  modulo?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  registroId?: string;
  animalId?: string;
  limit?: number;
  offset?: number;
}): Promise<HistorialListResponse> {
  const qs = new URLSearchParams();
  const ref = params?.referencia ?? params?.arete;
  if (ref) qs.set("referencia", ref);
  if (params?.modulo) qs.set("modulo", params.modulo);
  if (params?.accion) qs.set("accion", params.accion);
  if (params?.desde) qs.set("desde", params.desde);
  if (params?.hasta) qs.set("hasta", params.hasta);
  if (params?.registroId) qs.set("registroId", params.registroId);
  if (params?.animalId) qs.set("animalId", params.animalId);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));

  const query = qs.toString();
  const res = await fetch(`/api/historial${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  return parseJson<HistorialListResponse>(res);
}

/** @deprecated Usar fetchHistorial */
export const fetchHistorialAnimales = (params?: {
  arete?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}) =>
  fetchHistorial({
    ...params,
    referencia: params?.arete,
    modulo: "animales",
  });

export async function fetchHistorialByAnimal(animalId: string): Promise<HistorialEntry[]> {
  const res = await fetchHistorial({ animalId, limit: 100 });
  return res.items;
}
