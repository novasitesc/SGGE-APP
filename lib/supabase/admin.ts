import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

/** Polyfill WebSocket en Node < 22 (requerido por @supabase/realtime-js reciente). */
function ensureNodeWebSocket() {
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WS = require("ws") as typeof import("ws");
    (globalThis as { WebSocket: unknown }).WebSocket = WS;
  } catch {
    // Sin `ws` el cliente igual sirve para REST/Storage; Realtime fallaría al usarse.
  }
}

/**
 * Cliente Supabase con service_role: solo en servidor (Route Handlers, Server Actions).
 * Ignora RLS; no exponer la clave al cliente.
 */
export function createSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno."
    );
  }
  ensureNodeWebSocket();
  cached = createClient(normalizeSupabaseUrl(url), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
