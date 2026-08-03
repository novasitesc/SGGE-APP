import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export type AprobadorVerificado = {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  email: string;
  rolCodigo: string;
};

const ROLES_APROBADORES = ["gerente", "admin"] as const;

export function nombreCompleto(ap: AprobadorVerificado): string {
  return [ap.nombre, ap.apellido].filter(Boolean).join(" ") || ap.email;
}

function mapAprobador(row: {
  usuario_id?: string;
  id?: string;
  nombre: string;
  apellido: string | null;
  email: string;
  rol_codigo: string;
}): AprobadorVerificado {
  return {
    usuarioId: row.usuario_id ?? row.id!,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email,
    rolCodigo: row.rol_codigo,
  };
}

function rpcNoConfigurado(error: { message: string }): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("verificar_aprobador") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache")
  );
}

/** Verificación directa en Node (sin RPC en Supabase). */
async function verificarAprobadorDirecto(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<{ ok: true; aprobador: AprobadorVerificado } | { ok: false; message: string }> {
  const { data: user, error: userError } = await admin
    .from("usuarios")
    .select("id, nombre, apellido, email, password_hash, activo")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (userError) {
    if (userError.message.includes("usuarios") && userError.message.includes("does not exist")) {
      return {
        ok: false,
        message: "Tabla de usuarios no encontrada. Ejecute docs/database/schema.sql en Supabase.",
      };
    }
    return { ok: false, message: userError.message };
  }

  if (!user || !user.activo) {
    return {
      ok: false,
      message: "Credenciales inválidas o el usuario no tiene rol de gerente.",
    };
  }

  const hash = String(user.password_hash ?? "");
  const passwordOk =
    hash.startsWith("$2") && bcrypt.compareSync(password, hash);

  if (!passwordOk) {
    return {
      ok: false,
      message: "Credenciales inválidas o el usuario no tiene rol de gerente.",
    };
  }

  const { data: roleRows, error: roleError } = await admin
    .from("usuario_roles")
    .select("roles(codigo)")
    .eq("usuario_id", user.id);

  if (roleError) return { ok: false, message: roleError.message };

  type RoleJoin = { roles: { codigo: string } | { codigo: string }[] | null };
  const codigos = (roleRows ?? []).flatMap((row) => {
    const r = (row as RoleJoin).roles;
    if (!r) return [];
    if (Array.isArray(r)) return r.map((x) => x.codigo);
    return [r.codigo];
  });

  const rolCodigo = codigos.find((c) =>
    ROLES_APROBADORES.includes(c as (typeof ROLES_APROBADORES)[number])
  );

  if (!rolCodigo) {
    return {
      ok: false,
      message: "Credenciales inválidas o el usuario no tiene rol de gerente.",
    };
  }

  return {
    ok: true,
    aprobador: mapAprobador({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      rol_codigo: rolCodigo,
    }),
  };
}

/**
 * @deprecated Ola 1: las aprobaciones usan sesión Supabase Auth
 * (`aprobadorDesdeSesion`). No exponer email/password en endpoints.
 */
export async function verificarAprobadorGerente(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<{ ok: true; aprobador: AprobadorVerificado } | { ok: false; message: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) {
    return { ok: false, message: "El correo del gerente es obligatorio." };
  }
  if (!password) {
    return { ok: false, message: "La contraseña del gerente es obligatoria." };
  }

  const { data, error } = await admin.rpc("verificar_aprobador", {
    p_email: trimmedEmail,
    p_password: password,
  });

  if (error) {
    if (rpcNoConfigurado(error)) {
      return verificarAprobadorDirecto(admin, trimmedEmail, password);
    }
    return { ok: false, message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return verificarAprobadorDirecto(admin, trimmedEmail, password);
  }

  const rolCodigo = String((row as { rol_codigo: string }).rol_codigo);
  if (!ROLES_APROBADORES.includes(rolCodigo as (typeof ROLES_APROBADORES)[number])) {
    return {
      ok: false,
      message: "Solo un gerente o administrador puede aprobar esta baja.",
    };
  }

  const r = row as {
    usuario_id: string;
    nombre: string;
    apellido: string | null;
    email: string;
    rol_codigo: string;
  };

  return { ok: true, aprobador: mapAprobador(r) };
}

/** Aprobador a partir de la sesión ya autenticada (roles gerente|admin). */
export function aprobadorDesdeSesion(input: {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  email: string;
  roles: string[];
}): { ok: true; aprobador: AprobadorVerificado } | { ok: false; message: string } {
  const rolCodigo = input.roles.find((c) =>
    ROLES_APROBADORES.includes(c as (typeof ROLES_APROBADORES)[number])
  );
  if (!rolCodigo) {
    return {
      ok: false,
      message: "Solo un gerente o administrador puede aprobar esta baja.",
    };
  }
  return {
    ok: true,
    aprobador: {
      usuarioId: input.usuarioId,
      nombre: input.nombre,
      apellido: input.apellido,
      email: input.email,
      rolCodigo,
    },
  };
}

export function validarJustificacionEliminacion(texto: string): string | null {
  const t = texto.trim();
  if (!t) return "La justificación de la baja es obligatoria.";
  if (t.length < 20) {
    return "La justificación debe tener al menos 20 caracteres.";
  }
  return null;
}

export function validarDatosSolicitante(data: {
  nombre?: string;
  email?: string;
  cargo?: string;
}): string | null {
  const nombre = data.nombre?.trim() ?? "";
  if (!nombre) return "El nombre de quien solicita la baja es obligatorio.";
  if (nombre.length < 3) return "Indique el nombre completo de quien solicita.";
  const email = data.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "El correo del solicitante no es válido.";
  }
  return null;
}
