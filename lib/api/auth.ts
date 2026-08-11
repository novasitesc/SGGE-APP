import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/api/granja";
import { jsonError, jsonServerError } from "@/lib/api/http";

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

/** Máxima autoridad: autoriza modificaciones y acciones sensibles. */
export const ROL_ADMIN = "admin" as const;
/** Operación gerencial: gestiona datos, solicita aprobaciones; no autoriza. */
export const ROL_GERENTE = "gerente" as const;

const ROLES_APROBADORES = [ROL_ADMIN] as const;

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

  const porAuthId = await admin
    .from("usuarios")
    .select(usuarioSelect)
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const userError = porAuthId.error;
  let usuario = porAuthId.data;

  // Enlace inicial por email, solo durante la migración a Supabase Auth.
  // Tres condiciones obligatorias: el email debe estar confirmado en Auth, la
  // fila destino no puede tener ya un auth_user_id, y el email debe coincidir
  // exacto. Sin ellas, registrar una cuenta con el correo de un usuario de
  // negocio bastaría para heredar su granja y sus roles.
  if (!usuario && !userError && user.email && user.email_confirmed_at) {
    const email = user.email.trim().toLowerCase();
    const byEmail = await admin
      .from("usuarios")
      .select("id, granja_id, email, nombre, apellido, activo")
      .eq("email", email)
      .is("auth_user_id", null)
      .is("deleted_at", null)
      .maybeSingle();

    if (byEmail.error) {
      return {
        ok: false,
        response: jsonServerError("auth/enlace-email", byEmail.error),
      };
    }

    if (byEmail.data) {
      const { error: linkError } = await admin
        .from("usuarios")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.data.id)
        .is("auth_user_id", null);

      if (linkError) {
        return {
          ok: false,
          response: jsonServerError("auth/enlace-email", linkError),
        };
      }
      usuario = { ...byEmail.data, auth_user_id: user.id };
    }
  }

  if (userError) {
    return { ok: false, response: jsonServerError("auth/usuario", userError) };
  }

  if (!usuario || !usuario.activo) {
    console.error(
      `[auth] Sesión Auth sin usuario de negocio activo. auth_user_id=${user.id}`
    );
    return {
      ok: false,
      response: jsonError(
        "Su cuenta no está habilitada en la aplicación. Contacte al administrador.",
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

/** True si el usuario es administrador (máxima autoridad). */
export function esAdmin(roles: string[]): boolean {
  return roles.includes(ROL_ADMIN);
}

/** True si el usuario tiene rol de gerencia (sin poder de autorización). */
export function esGerencia(roles: string[]): boolean {
  return roles.includes(ROL_GERENTE);
}

/**
 * True si puede autorizar solicitudes / acciones sensibles.
 * Solo admin — gerencia solicita, no aprueba.
 */
export function esAprobador(roles: string[]): boolean {
  return roles.some((c) =>
    ROLES_APROBADORES.includes(c as (typeof ROLES_APROBADORES)[number])
  );
}

/** 403 si la sesión no es admin. Usar tras `requireApiContext`. */
export function requireAdmin(
  roles: string[],
  message = "Solo un administrador puede realizar esta acción."
): NextResponse | null {
  if (esAdmin(roles)) return null;
  return jsonError(message, 403);
}
