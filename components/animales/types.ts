import type { Animal, AnimalStatus, AcquisitionType } from "@/lib/mockData";
import { parseWeightField } from "@/lib/api/weight-utils";

export type PesajeRecord = {
  id: string;
  fecha: string;
  pesoKg: number;
  tipo: string;
};

export type ActaRecord = {
  id: string;
  fecha: string;
  texto: string;
  autorNombre?: string;
  createdAt: string;
};

export type AnimalMetrics = {
  gainKg: number;
  daysInFeedlot: number;
  adg: number;
};

export type AnimalDetail = Animal & {
  observaciones?: string;
  metrics: AnimalMetrics;
  pesajes: PesajeRecord[];
  actas: ActaRecord[];
  purchase?: AnimalPurchaseInfo;
  sale?: AnimalSaleInfo;
  margin?: {
    perKg: number;
    total: number;
    pct: number | null;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canChangeArete: boolean;
  };
};

export type AnimalFormValues = {
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: string;
  currentWeight: string;
  moduleId: string;
  status: AnimalStatus;
  sex: "M" | "H";
  age: string;
  observaciones: string;
  /** Compra / adquisición */
  acquisitionType: AcquisitionType;
  purchasePricePerKg: string;
  invoiceFolio: string;
  invoiceOrAuctionDate: string;
  auctionLotNumber: string;
  /** Datos de venta (requeridos al marcar como vendido) */
  saleDate: string;
  salePricePerKg: string;
  saleBuyer: string;
};

export type AnimalPurchaseInfo = {
  pricePerKg: number;
  totalCost: number;
  purchaseWeightKg: number;
  purchaseDate: string;
  acquisitionType: string;
  folio?: string;
  auctionLotNumber?: string;
};

export type AnimalSaleInfo = {
  saleDate: string;
  buyer: string;
  pricePerKg: number;
  totalRevenue: number;
  pesoSalidaKg: number;
};

export const STATUS_CONFIG: Record<
  AnimalStatus,
  { label: string; variant: "success" | "info" | "destructive" | "warning" }
> = {
  activo: { label: "Activo", variant: "success" },
  vendido: { label: "Vendido", variant: "info" },
  muerto: { label: "Muerto", variant: "destructive" },
  enfermo: { label: "Enfermo", variant: "warning" },
};

export const BREEDS = ["Angus", "Simmental", "Brahman", "Charolais", "Hereford"];

export const ACQUISITION_OPTIONS: { value: AcquisitionType; label: string }[] = [
  { value: "subasta", label: "Subasta / remate" },
  { value: "particular", label: "Compra particular" },
  { value: "otro", label: "Otro" },
];

export const EMPTY_ANIMAL_FORM: AnimalFormValues = {
  tagId: "",
  breed: "Angus",
  entryDate: new Date().toISOString().split("T")[0],
  initialWeight: "",
  currentWeight: "",
  moduleId: "M1",
  status: "activo",
  sex: "M",
  age: "",
  observaciones: "",
  acquisitionType: "subasta",
  purchasePricePerKg: "",
  invoiceFolio: "",
  invoiceOrAuctionDate: new Date().toISOString().split("T")[0],
  auctionLotNumber: "",
  saleDate: new Date().toISOString().split("T")[0],
  salePricePerKg: "",
  saleBuyer: "",
};

export function animalToForm(
  animal: Animal,
  sale?: AnimalSaleInfo,
  purchase?: AnimalPurchaseInfo
): AnimalFormValues {
  return {
    tagId: animal.tagId,
    breed: animal.breed,
    entryDate: animal.entryDate,
    initialWeight: String(animal.initialWeight),
    currentWeight: String(animal.currentWeight),
    moduleId: animal.moduleId,
    status: animal.status,
    sex: animal.sex,
    age: String(animal.age ?? ""),
    observaciones: "",
    acquisitionType:
      animal.acquisitionType ??
      (purchase?.acquisitionType as AcquisitionType | undefined) ??
      "subasta",
    purchasePricePerKg: purchase
      ? String(purchase.pricePerKg)
      : animal.purchasePricePerKg != null
        ? String(animal.purchasePricePerKg)
        : "",
    invoiceFolio: animal.invoiceFolio ?? purchase?.folio ?? "",
    invoiceOrAuctionDate:
      animal.invoiceOrAuctionDate ?? purchase?.purchaseDate ?? animal.entryDate,
    auctionLotNumber: animal.auctionLotNumber ?? purchase?.auctionLotNumber ?? "",
    saleDate: sale?.saleDate ?? new Date().toISOString().split("T")[0],
    salePricePerKg: sale ? String(sale.pricePerKg) : "",
    saleBuyer: sale?.buyer ?? "",
  };
}

export function formToPayload(form: AnimalFormValues) {
  const base = {
    tagId: form.tagId.trim(),
    breed: form.breed,
    entryDate: form.entryDate,
    initialWeight: parseWeightField(form.initialWeight),
    currentWeight: parseWeightField(form.currentWeight),
    moduleId: form.moduleId,
    status: form.status,
    sex: form.sex,
    age: Number(form.age) || 0,
    acquisitionType: form.acquisitionType,
    purchasePricePerKg: Number(form.purchasePricePerKg),
    invoiceFolio: form.invoiceFolio.trim() || undefined,
    invoiceOrAuctionDate: form.invoiceOrAuctionDate || form.entryDate,
    auctionLotNumber: form.auctionLotNumber.trim() || undefined,
  };

  if (form.status === "vendido") {
    return {
      ...base,
      saleDate: form.saleDate,
      salePricePerKg: Number(form.salePricePerKg),
      saleBuyer: form.saleBuyer.trim(),
    };
  }

  return base;
}

export function validateAnimalForm(
  form: AnimalFormValues,
  mode: "create" | "edit"
): string | null {
  if (!form.tagId.trim()) return "El arete es obligatorio.";
  if (!form.entryDate) return "La fecha de ingreso es obligatoria.";
  if (!form.initialWeight || Number(form.initialWeight) <= 0) {
    return "El peso inicial debe ser mayor a 0.";
  }
  if (!form.currentWeight || Number(form.currentWeight) <= 0) {
    return "El peso actual debe ser mayor a 0.";
  }
  if (mode === "create") {
    if (!form.purchasePricePerKg || Number(form.purchasePricePerKg) < 0) {
      return "Indique el precio de compra por kg (₡/kg).";
    }
  }
  if (mode === "create" && form.status === "vendido") {
    return "No se puede registrar un animal nuevo ya como vendido.";
  }
  if (form.status === "vendido") {
    if (!form.saleDate) return "La fecha de venta es obligatoria.";
    if (!form.saleBuyer.trim()) return "El comprador es obligatorio.";
    if (!form.salePricePerKg || Number(form.salePricePerKg) < 0) {
      return "Indique el precio de venta por kg.";
    }
  }
  return null;
}

/** Estados finales: no se eliminan desde inventario. */
export function isFinalStatus(status: AnimalStatus): boolean {
  return status === "vendido" || status === "muerto";
}
