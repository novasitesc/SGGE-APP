import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnimalRowSrrg } from "@/lib/api/animales-query";
import {
  registrarHistorial,
  type HistorialAccion,
  type HistorialRow,
  mapHistorialToApi,
} from "@/lib/api/historial-sistema";

export type { HistorialAccion, HistorialRow };
export { mapHistorialToApi };

export type AnimalHistorialSnapshot = {
  arete: string;
  raza: string;
  sexo: string;
  estado: string;
  corral: string;
  pesoInicialKg: number;
  pesoActualKg: number;
  fechaIngreso: string;
  observaciones?: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  tagId: "Arete",
  arete: "Arete",
  breed: "Raza",
  raza: "Raza",
  entryDate: "Fecha ingreso",
  fechaIngreso: "Fecha ingreso",
  initialWeight: "Peso inicial",
  pesoInicialKg: "Peso inicial",
  currentWeight: "Peso actual",
  pesoActualKg: "Peso actual",
  moduleId: "Corral",
  corral: "Corral",
  status: "Estado",
  estado: "Estado",
  sex: "Sexo",
  sexo: "Sexo",
  observaciones: "Observaciones",
};

export function snapshotFromAnimalRow(row: AnimalRowSrrg): AnimalHistorialSnapshot {
  return {
    arete: row.arete,
    raza: row.razas?.nombre ?? "—",
    sexo: row.sexo === "H" ? "Hembra" : "Macho",
    estado: row.estados_animales?.nombre ?? row.estados_animales?.codigo ?? "—",
    corral: row.corrales?.codigo ?? "—",
    pesoInicialKg: Number(row.peso_inicial_kg),
    pesoActualKg: Number(row.peso_actual_kg),
    fechaIngreso: row.fecha_ingreso,
    observaciones: row.observaciones,
  };
}

export function snapshotFromApiBody(body: {
  tagId?: string;
  breed?: string;
  entryDate?: string;
  initialWeight?: number;
  currentWeight?: number;
  moduleId?: string;
  status?: string;
  sex?: string;
  observaciones?: string;
}): Partial<AnimalHistorialSnapshot> {
  const snap: Partial<AnimalHistorialSnapshot> = {};
  if (body.tagId != null) snap.arete = body.tagId.trim();
  if (body.breed != null) snap.raza = body.breed;
  if (body.entryDate != null) snap.fechaIngreso = body.entryDate;
  if (body.initialWeight != null) snap.pesoInicialKg = body.initialWeight;
  if (body.currentWeight != null) snap.pesoActualKg = body.currentWeight;
  if (body.moduleId != null) snap.corral = body.moduleId;
  if (body.status != null) snap.estado = body.status;
  if (body.sex != null) snap.sexo = body.sex === "H" ? "Hembra" : "Macho";
  if (body.observaciones !== undefined) snap.observaciones = body.observaciones || null;
  return snap;
}

function formatValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key.toLowerCase().includes("peso") && typeof value === "number") return `${value} kg`;
  return String(value);
}

export function buildCambiosResumen(
  anterior: AnimalHistorialSnapshot,
  cambios: Partial<AnimalHistorialSnapshot> & Record<string, unknown>
): string {
  const partes: string[] = [];
  const pairs: [string, keyof AnimalHistorialSnapshot][] = [
    ["arete", "arete"],
    ["raza", "raza"],
    ["sexo", "sexo"],
    ["estado", "estado"],
    ["corral", "corral"],
    ["fechaIngreso", "fechaIngreso"],
    ["pesoInicialKg", "pesoInicialKg"],
    ["pesoActualKg", "pesoActualKg"],
    ["observaciones", "observaciones"],
  ];

  for (const [campo, snapKey] of pairs) {
    const nuevo = cambios[snapKey];
    if (nuevo === undefined) continue;
    const prev = anterior[snapKey];
    if (String(prev ?? "") !== String(nuevo ?? "")) {
      const label = FIELD_LABELS[campo] ?? campo;
      partes.push(`${label}: ${formatValue(campo, prev)} → ${formatValue(campo, nuevo)}`);
    }
  }

  return partes.length === 0 ? "Modificación registrada." : partes.join(" · ");
}

export type RegistrarHistorialAnimalInput = {
  granjaId: string;
  animalId: string;
  arete: string;
  accion: HistorialAccion;
  resumen: string;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
  usuarioId?: string | null;
};

export async function registrarHistorialAnimal(
  admin: SupabaseClient,
  input: RegistrarHistorialAnimalInput
): Promise<void> {
  await registrarHistorial(admin, {
    granjaId: input.granjaId,
    modulo: "animales",
    registroId: input.animalId,
    referencia: input.arete,
    accion: input.accion,
    resumen: input.resumen,
    datosAnteriores: input.datosAnteriores,
    datosNuevos: input.datosNuevos,
    usuarioId: input.usuarioId,
  });
}
