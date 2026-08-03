import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/api/granja";
import { jsonError } from "@/lib/api/http";

export type UsuarioNegocio = {
  id: string;
  granja_id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  activo: boolean;
};

export type ApiContext = {
  user: User;
  usuario: UsuarioNegocio;
  granjaId: string;
  admin: SupabaseClient;
  roles: string[];
};

export type ApiAuthResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: NextResponse };

const ROLES_APROBADORES = ["gerente", "admin"] as const;

/**
 * Exige sesión Supabase Auth + fila usuarios vinculada (auth_user_id).
 * Resuelve granjaId = usuarios.granja_id; si farmId/granjaId en query
 * difiere → 403 (anti-IDOR).
 */
export async function requireApiContext(req: Request): Promise<ApiAuthResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      ok: false,
      response: jsonError("Configuración de autenticación incompleta.", 500),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: jsonError("No autenticado.", 401) };
  }

  const admin = createSupabaseAdmin();

  const usuarioSelect =
    "id, granja_id, email, nombre, apellido, activo, auth_user_id";

  let { data: usuario, error: userError } = await admin
    .from("usuarios")
    .select(usuarioSelect)
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Fallback: Auth OK pero sin match por auth_user_id (enlace pendiente / cache).
  // Busca por email y rellena auth_user_id automáticamente.
  if ((!usuario || userError) && user.email) {
    const email = user.email.trim().toLowerCase();
    const byEmail = await admin
      .from("usuarios")
      .select("id, granja_id, email, nombre, apellido, activo")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (byEmail.error) {
      return { ok: false, response: jsonError(byEmail.error.message, 500) };
    }

    if (byEmail.data) {
      await admin
        .from("usuarios")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.data.id);
      usuario = { ...byEmail.data, auth_user_id: user.id };
      userError = null;
    }
  }

  if (userError) {
    return { ok: false, response: jsonError(userError.message, 500) };
  }

  if (!usuario || !usuario.activo) {
    return {
      ok: false,
      response: jsonError(
        `Usuario no vinculado a la aplicación o inactivo (auth: ${user.id}). Verifique public.usuarios.auth_user_id.`,
        403
      ),
    };
  }

  if (!usuario.granja_id || !isUuid(usuario.granja_id)) {
    return {
      ok: false,
      response: jsonError("El usuario no tiene granja asignada.", 403),
    };
  }

  const url = new URL(req.url);
  const param =
    url.searchParams.get("farmId") ?? url.searchParams.get("granjaId");

  if (param && isUuid(param) && param !== usuario.granja_id) {
    return {
      ok: false,
      response: jsonError("No tiene acceso a esta granja.", 403),
    };
  }

  const roles = await loadRoles(admin, usuario.id);

  return {
    ok: true,
    ctx: {
      user,
      usuario: usuario as UsuarioNegocio,
      granjaId: usuario.granja_id,
      admin,
      roles,
    },
  };
}

async function loadRoles(
  admin: SupabaseClient,
  usuarioId: string
): Promise<string[]> {
  const { data: roleRows, error } = await admin
    .from("usuario_roles")
    .select("roles(codigo)")
    .eq("usuario_id", usuarioId);

  if (error || !roleRows) return [];

  type RoleJoin = { roles: { codigo: string } | { codigo: string }[] | null };
  return roleRows.flatMap((row) => {
    const r = (row as RoleJoin).roles;
    if (!r) return [];
    if (Array.isArray(r)) return r.map((x) => x.codigo);
    return [r.codigo];
  });
}

/** True si el usuario tiene rol gerente o admin. */
export function esAprobador(roles: string[]): boolean {
  return roles.some((c) =>
    ROLES_APROBADORES.includes(c as (typeof ROLES_APROBADORES)[number])
  );
}
