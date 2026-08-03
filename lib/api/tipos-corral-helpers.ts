import type { SupabaseClient } from "@supabase/supabase-js";
import { MODULE_TYPE_OPTIONS } from "@/lib/modulos/constants";
import {
  MODULE_TYPE_PREFIXES,
  prefixForModuleType,
} from "@/lib/modulos/codigo";

export type TipoCorralRow = {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
  activo: boolean;
};

export function mapTipoCorralRow(raw: Record<string, unknown>): TipoCorralRow {
  const codigo = String(raw.codigo ?? "");
  return {
    id: String(raw.id ?? codigo),
    codigo,
    nombre: String(raw.nombre ?? codigo),
    prefijo: String(raw.prefijo ?? prefixForModuleType(codigo)),
    activo: raw.activo == null ? true : Boolean(raw.activo),
  };
}

/** Filas sintéticas desde constantes (fallback si no hay tabla/filas). */
export function tiposFromConstants(): TipoCorralRow[] {
  return MODULE_TYPE_OPTIONS.map((o) => ({
    id: `const:${o.value}`,
    codigo: o.value,
    nombre: o.label,
    prefijo: MODULE_TYPE_PREFIXES[o.value] ?? "X",
    activo: true,
  }));
}

export async function listTiposCorral(
  admin: SupabaseClient
): Promise<{ rows: TipoCorralRow[]; fromDb: boolean }> {
  const { data, error } = await admin
    .from("tipos_corral")
    .select("*")
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (error) {
    // Tabla aún no migrada → constantes.
    return { rows: tiposFromConstants(), fromDb: false };
  }

  const rows = (data ?? []).map((r) =>
    mapTipoCorralRow(r as Record<string, unknown>)
  );
  if (rows.length === 0) {
    return { rows: tiposFromConstants(), fromDb: true };
  }
  return { rows, fromDb: true };
}

export async function validTipoCorralCodigos(
  admin: SupabaseClient
): Promise<Set<string>> {
  const { rows } = await listTiposCorral(admin);
  return new Set(
    rows.filter((r) => r.activo).map((r) => r.codigo)
  );
}
