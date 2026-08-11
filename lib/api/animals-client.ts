import type { Animal } from "@/lib/types/domain";
import type { AnimalDetail, ActaRecord, PesajeRecord } from "@/components/animales/types";
import { parseJson } from "@/lib/api/parse-json";

export async function fetchAnimals(loteId?: string | null): Promise<Animal[]> {
  const qs = loteId ? `?loteId=${encodeURIComponent(loteId)}` : "";
  const res = await fetch(`/api/animals${qs}`, { cache: "no-store" });
  return parseJson<Animal[]>(res);
}

export async function fetchAnimalById(id: string): Promise<AnimalDetail> {
  const res = await fetch(`/api/animals/${id}`, { cache: "no-store" });
  return parseJson<AnimalDetail>(res);
}

export async function fetchAnimalPesajes(animalId: string): Promise<PesajeRecord[]> {
  const res = await fetch(`/api/animals/${animalId}/weights`, { cache: "no-store" });
  const data = await parseJson<{ pesajes: PesajeRecord[] }>(res);
  return data.pesajes;
}

export async function fetchAnimalActas(animalId: string): Promise<ActaRecord[]> {
  const res = await fetch(`/api/animals/${animalId}/actas`, { cache: "no-store" });
  const data = await parseJson<{ actas: ActaRecord[] }>(res);
  return data.actas;
}

export async function createActaAnimal(
  animalId: string,
  data: { fecha: string; texto: string; autorNombre?: string }
): Promise<ActaRecord> {
  const res = await fetch(`/api/animals/${animalId}/actas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await parseJson<{ acta: ActaRecord }>(res);
  return body.acta;
}

export async function createAnimal(data: {
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: number;
  currentWeight: number;
  moduleId: string;
  status: string;
  sex: string;
  age?: number;
  observaciones?: string;
  acquisitionType?: string;
  purchasePricePerKg: number;
  invoiceFolio?: string;
  invoiceOrAuctionDate?: string;
  auctionLotNumber?: string;
  /** Lote de engorda; si se omite, el API usa el lote abierto por defecto. */
  loteId?: string;
}): Promise<Animal> {
  const res = await fetch("/api/animals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Animal>(res);
}

export async function updateAnimalApi(
  id: string,
  data: Partial<{
    tagId: string;
    breed: string;
    entryDate: string;
    initialWeight: number;
    currentWeight: number;
    moduleId: string;
    status: string;
    sex: string;
    age: number;
    observaciones: string;
    saleDate: string;
    salePricePerKg: number;
    saleBuyer: string;
  }>
): Promise<Animal> {
  const res = await fetch(`/api/animals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Animal>(res);
}

export async function registerPesaje(
  animalId: string,
  weightKg: number,
  measuredAt?: string
): Promise<void> {
  const res = await fetch(`/api/animals/${animalId}/weights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weightKg, measuredAt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Error al registrar pesaje");
  }
}

export async function fetchCorrales(): Promise<{ id: string; name: string }[]> {
  const res = await fetch("/api/modules", { cache: "no-store" });
  const list = await parseJson<
    { id: string; name: string; capacity: number; animalCount: number }[]
  >(res);
  return list.map((m) => ({ id: m.id, name: m.name || m.id }));
}
