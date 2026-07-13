import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy de Next.js 16 (reemplaza middleware.ts, deprecado).
 * Refresca la sesión Supabase y protege las secciones de la app SGGE.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Incluye app, gestión, auth y API; excluye estáticos de Next.
     * Secciones reconocidas: ver SGGE_ROUTE_SECTIONS en lib/supabase/proxy.ts
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
