import type { AnimalRowSrrg } from "./animales-query";
import type { CompraAnimalInfo } from "./compra-animal";
import { normalizeCostCategoryKey } from "@/lib/costs/categories";
import type { Cost, CostSource } from "@/lib/types/domain";

export type { AnimalRowSrrg };

function monthsBetween(birthIso: string, end: Date): number {
  const birth = new Date(birthIso + "T12:00:00Z");
  return Math.max(
    0,
    (end.getFullYear() - birth.getFullYear()) * 12 +
      (end.getMonth() - birth.getMonth())
  );
}

/** Mapea fila SRRG (animales + joins) al contrato del frontend. */
export function mapAnimalToApi(row: AnimalRowSrrg, purchase?: CompraAnimalInfo | null) {
  return {
    id: row.id,
    tagId: row.arete,
    breed: row.razas?.nombre ?? "",
    entryDate: row.fecha_ingreso,
    initialWeight: Number(row.peso_inicial_kg),
    currentWeight: Number(row.peso_actual_kg),
    moduleId: row.corrales?.codigo ?? "",
    moduleName: row.corrales?.nombre ?? undefined,
    loteId: row.lote_id ?? null,
    status: row.estados_animales?.codigo ?? "activo",
    sex: row.sexo,
    age: row.fecha_nacimiento ? monthsBetween(row.fecha_nacimiento, new Date()) : 0,
    acquisitionType: purchase?.acquisitionType as "subasta" | "particular" | "otro" | undefined,
    invoiceFolio: purchase?.folio,
    invoiceOrAuctionDate: purchase?.purchaseDate,
    auctionLotNumber: purchase?.auctionLotNumber,
    purchasePricePerKg: purchase?.pricePerKg,
    purchaseTotalCost: purchase?.totalCost,
  };
}

/** @deprecated Usar AnimalRowSrrg */
export type AnimalRow = AnimalRowSrrg;

export type CostRowExtras = {
  source?: CostSource;
  issuer?: string | null;
  comprobanteId?: string | null;
  fileName?: string | null;
};

export function mapCostRow(row: Record<string, unknown>, extras?: CostRowExtras): Cost {
  const catRaw = row.categorias_gastos;
  const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
  const codigo = (cat as { codigo?: string } | null)?.codigo;
  return {
    id: row.id as string,
    category: normalizeCostCategoryKey(codigo),
    description: row.concepto as string,
    amount: Number(row.monto),
    date: row.fecha as string,
    source: extras?.source ?? "manual",
    issuer: extras?.issuer ?? null,
    comprobanteId: extras?.comprobanteId ?? null,
    fileName: extras?.fileName ?? null,
  };
}

export function mapTreatmentRow(row: {
  id: string;
  type: string;
  name: string;
  date: string;
  animal_count: number;
  cost_per_animal: number;
  total_cost: number;
  applied_by: string;
  notes: string;
  next_due: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    date: row.date,
    animalCount: row.animal_count,
    costPerAnimal: Number(row.cost_per_animal),
    totalCost: Number(row.total_cost),
    appliedBy: row.applied_by,
    notes: row.notes,
    nextDue: row.next_due ?? undefined,
  };
}

export function mapSaleRow(row: {
  id: string;
  tag_id: string;
  breed: string;
  final_weight: number;
  price_per_kg: number;
  total_revenue: number;
  sale_date: string;
  buyer: string;
  module_code: string;
  source?: "animal" | "factura";
  notes?: string;
}) {
  return {
    id: row.id,
    tagId: row.tag_id,
    breed: row.breed,
    finalWeight: Number(row.final_weight),
    pricePerKg: Number(row.price_per_kg),
    totalRevenue: Number(row.total_revenue),
    saleDate: row.sale_date,
    buyer: row.buyer,
    moduleId: row.module_code,
    source: row.source,
    notes: row.notes,
  };
}

export function mapAlertRow(row: {
  id: string;
  animal_id: string | null;
  tag_id: string | null;
  type: string;
  message: string;
  due_date: string;
  priority: string;
}) {
  return {
    id: row.id,
    animalId: row.animal_id ?? undefined,
    tagId: row.tag_id ?? undefined,
    type: row.type,
    message: row.message,
    dueDate: row.due_date,
    priority: row.priority,
  };
}
