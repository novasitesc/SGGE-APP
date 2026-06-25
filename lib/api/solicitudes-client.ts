export type SolicitudAprobacion = {
  id: string;
  type: string;
  typeLabel: string;
  recordId: string;
  reference: string;
  justification: string;
  requesterName: string;
  requesterEmail: string | null;
  requesterRole: string | null;
  recordData: Record<string, unknown> | null;
  status: "pendiente" | "aprobada" | "rechazada";
  resolutionNotes: string | null;
  approverId: string | null;
  approverName: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AnimalDeleteRequestPayload = {
  justification: string;
  requesterName: string;
  requesterEmail?: string;
  requesterRole?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Error en la solicitud");
  }
  return body as T;
}

export async function requestAnimalDeletionApi(
  id: string,
  data: AnimalDeleteRequestPayload
): Promise<SolicitudAprobacion> {
  const res = await fetch(`/api/animals/${id}/solicitud-baja`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<SolicitudAprobacion>(res);
}

export async function fetchSolicitudes(params?: {
  estado?: string;
  registroId?: string;
}): Promise<{ items: SolicitudAprobacion[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.registroId) qs.set("registroId", params.registroId);
  const res = await fetch(`/api/solicitudes-aprobacion?${qs}`, { cache: "no-store" });
  return parseJson(res);
}

export async function fetchPendingSolicitudesCount(): Promise<number> {
  const res = await fetch("/api/solicitudes-aprobacion/count", { cache: "no-store" });
  const data = await parseJson<{ pending: number }>(res);
  return data.pending;
}

export async function resolveSolicitudApi(
  id: string,
  data: {
    action: "aprobar" | "rechazar";
    approverEmail: string;
    approverPassword: string;
    notes?: string;
  }
): Promise<SolicitudAprobacion> {
  const res = await fetch(`/api/solicitudes-aprobacion/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<SolicitudAprobacion>(res);
}
