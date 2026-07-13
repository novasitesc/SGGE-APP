import type { SupabaseClient } from "@supabase/supabase-js";

export type RazaRow = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
};

/** Código corto a partir del nombre (máx. 8 chars, alfanumérico). */
export function codigoFromNombre(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return base || "RAZA";
}

export async function nextCodigoRaza(
  admin: SupabaseClient,
  granjaId: string,
  nombre: string
): Promise<string> {
  const base = codigoFromNombre(nombre);
  const { data, error } = await admin
    .from("razas")
    .select("codigo")
    .eq("granja_id", granjaId)
    .ilike("codigo", `${base}%`);
  if (error) throw new Error(error.message);

  const used = new Set((data ?? []).map((r: { codigo: string }) => r.codigo.toUpperCase()));
  if (!used.has(base)) return base;

  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 5)}${i}`.slice(0, 20);
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-3)}`.slice(0, 20);
}

export async function findRazaByNombre(
  admin: SupabaseClient,
  granjaId: string,
  nombre: string,
  excludeId?: string
): Promise<RazaRow | null> {
  let q = admin
    .from("razas")
    .select("id, codigo, nombre, activa")
    .eq("granja_id", granjaId)
    .is("deleted_at", null)
    .ilike("nombre", nombre.trim());
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data as RazaRow | null;
}
