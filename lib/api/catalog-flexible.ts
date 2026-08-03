import type { SupabaseClient } from "@supabase/supabase-js";

/** Extrae el nombre de columna desconocida en errores PostgREST/Postgres. */
export function unknownColumnFromError(message: string): string | null {
  const patterns = [
    /Could not find the '(\w+)' column/i,
    /column ["'](\w+)["'] of relation/i,
    /column (\w+) does not exist/i,
  ];
  for (const re of patterns) {
    const m = message.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isMissingRelation(message: string): boolean {
  return (
    /does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

/**
 * Inserta una fila; si PostgREST rechaza columnas inexistentes, las quita
 * (excepto `required`) y reintenta.
 */
export async function insertFlexible<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  row: T,
  required: string[] = []
): Promise<{ data: Record<string, unknown>; error: string | null; missingTable?: boolean }> {
  const payload: Record<string, unknown> = { ...row };
  for (let i = 0; i < 10; i++) {
    const { data, error } = await admin
      .from(table)
      .insert(payload)
      .select("*")
      .single();
    if (!error) return { data: data as Record<string, unknown>, error: null };
    if (isMissingRelation(error.message) && i === 0) {
      return { data: {}, error: error.message, missingTable: true };
    }
    const col = unknownColumnFromError(error.message);
    if (col && !(required.includes(col)) && col in payload) {
      delete payload[col];
      continue;
    }
    return { data: {}, error: error.message };
  }
  return { data: {}, error: "No se pudo insertar el registro." };
}

/**
 * Actualiza una fila con el mismo reintento ante columnas inexistentes.
 */
export async function updateFlexible(
  admin: SupabaseClient,
  table: string,
  id: string,
  patch: Record<string, unknown>,
  required: string[] = []
): Promise<{ data: Record<string, unknown>; error: string | null }> {
  const payload: Record<string, unknown> = { ...patch };
  for (let i = 0; i < 10; i++) {
    const { data, error } = await admin
      .from(table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (!error) return { data: data as Record<string, unknown>, error: null };
    const col = unknownColumnFromError(error.message);
    if (col && !(required.includes(col)) && col in payload) {
      delete payload[col];
      continue;
    }
    return { data: {}, error: error.message };
  }
  return { data: {}, error: "No se pudo actualizar el registro." };
}

/** Código corto a partir del nombre (máx. 8 chars, alfanumérico). */
export function codigoFromNombre(nombre: string, fallback = "CAT"): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return base || fallback;
}

export async function nextCatalogCodigo(
  admin: SupabaseClient,
  table: string,
  granjaId: string | null,
  nombre: string,
  fallback: string
): Promise<string> {
  const base = codigoFromNombre(nombre, fallback);
  let q = admin.from(table).select("codigo").ilike("codigo", `${base}%`);
  if (granjaId) q = q.eq("granja_id", granjaId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const used = new Set(
    (data ?? []).map((r: { codigo: string }) => String(r.codigo).toUpperCase())
  );
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 5)}${i}`.slice(0, 20);
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-3)}`.slice(0, 20);
}
