import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Secciones del sistema SGGE reconocidas por el Proxy (Next.js 16).
 * Reemplaza la lógica que antes vivía en middleware.ts.
 */
export const SGGE_ROUTE_SECTIONS = {
  /** Rutas de autenticación (públicas) */
  auth: ["/login", "/auth", "/callback"] as const,
  /** App operativa bajo (dashboard) */
  app: [
    "/dashboard",
    "/animals",
    "/modules",
    "/feeding",
    "/costs",
    "/health",
    "/sales",
    "/reports",
    "/administracion",
  ] as const,
  /** Administración / gestión */
  admin: ["/gestion"] as const,
  /** API Route Handlers */
  api: ["/api"] as const,
} as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthRoute(pathname: string): boolean {
  return matchesPrefix(pathname, SGGE_ROUTE_SECTIONS.auth);
}

export function isProtectedAppRoute(pathname: string): boolean {
  return (
    matchesPrefix(pathname, SGGE_ROUTE_SECTIONS.app) ||
    matchesPrefix(pathname, SGGE_ROUTE_SECTIONS.admin)
  );
}

export function isApiRoute(pathname: string): boolean {
  return matchesPrefix(pathname, SGGE_ROUTE_SECTIONS.api);
}

/**
 * Refresca la sesión Supabase Auth en cookies y aplica protección de rutas.
 * Debe invocarse solo desde `proxy.ts` (convención Next.js 16; middleware deprecado).
 *
 * Protección de rutas: activar con AUTH_PROXY_ENFORCE=true cuando el login
 * con Supabase Auth esté cableado. Sin esa flag, solo se refresca la sesión.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        );
      },
    },
  });

  // No ejecutar lógica entre createServerClient y la verificación de auth.
  // Preferir getClaims() (valida JWT); fallback a getUser() si no está disponible.
  let userId: string | undefined;
  if (typeof supabase.auth.getClaims === "function") {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub as string | undefined;
  } else {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  }

  const enforceAuth = process.env.AUTH_PROXY_ENFORCE === "true";
  if (!enforceAuth) {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // API: no redirigir (los handlers deciden auth / service role).
  if (isApiRoute(pathname)) {
    return supabaseResponse;
  }

  // App y administración: requieren sesión.
  if (isProtectedAppRoute(pathname) && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Usuario autenticado no debe quedarse en login.
  if (isAuthRoute(pathname) && userId && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
