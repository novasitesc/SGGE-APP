import { parseJson } from "@/lib/api/parse-json";

export type ComprobanteAnimalLine = {
  codigo: string;
  tipo: string;
  color: string;
  vendedor: string;
  pesoKg: number;
  precioKg: number;
  monto: number;
};

export type Comprobante = {
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
  animales?: ComprobanteAnimalLine[];
  pesoTotalKg?: number | null;
  parseReason?: string | null;
};

export type UploadResult = {
  items: (Comprobante & { duplicated?: boolean })[];
  results: { name: string; ok: boolean; duplicated?: boolean; error?: string }[];
};

export async function fetchComprobantes(estado?: string): Promise<Comprobante[]> {
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : "";
  const res = await fetch(`/api/comprobantes${qs}`, { cache: "no-store" });
  return parseJson<Comprobante[]>(res);
}

export async function uploadComprobantes(files: File[]): Promise<UploadResult> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await fetch("/api/comprobantes", { method: "POST", body: fd });
  return parseJson<UploadResult>(res);
}

export type ConfirmPayload = {
  classification: "gasto" | "compra_ganado";
  issuer?: string | null;
  issuerId?: string | null;
  issueDate?: string | null;
  amount?: number | null;
  categoryCode?: string | null;
  description?: string | null;
  totalWeightKg?: number | null;
};

export async function confirmComprobante(
  id: string,
  payload: ConfirmPayload
): Promise<Comprobante> {
  const res = await fetch(`/api/comprobantes/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Comprobante>(res);
}

export async function deleteComprobante(id: string): Promise<void> {
  const res = await fetch(`/api/comprobantes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al eliminar");
  }
}
