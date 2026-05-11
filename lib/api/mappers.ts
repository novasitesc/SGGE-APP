/** Fila animals + code del módulo (si existe) */
export type AnimalRow = {
  id: string;
  farm_id: string;
  tag_id: string;
  breed: string;
  entry_date: string;
  initial_weight: number;
  current_weight: number;
  module_id: string | null;
  status: string;
  sex: string;
  age_months: number;
  acquisition_type?: string | null;
  invoice_folio?: string | null;
  invoice_or_auction_date?: string | null;
  auction_lot_number?: string | null;
  purchase_price_per_kg?: number | null;
};

export function mapAnimalToApi(
  row: AnimalRow,
  moduleCodeById: Map<string, string>
) {
  return {
    id: row.id,
    tagId: row.tag_id,
    breed: row.breed,
    entryDate: row.entry_date,
    initialWeight: Number(row.initial_weight),
    currentWeight: Number(row.current_weight),
    moduleId: row.module_id ? moduleCodeById.get(row.module_id) ?? "" : "",
    status: row.status,
    sex: row.sex,
    age: row.age_months,
    acquisitionType: row.acquisition_type ?? undefined,
    invoiceFolio: row.invoice_folio ?? undefined,
    invoiceOrAuctionDate: row.invoice_or_auction_date ?? undefined,
    auctionLotNumber: row.auction_lot_number ?? undefined,
    purchasePricePerKg:
      row.purchase_price_per_kg != null
        ? Number(row.purchase_price_per_kg)
        : undefined,
  };
}

export function mapCostRow(row: {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  animal_count: number | null;
}) {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    animalCount: row.animal_count ?? undefined,
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
