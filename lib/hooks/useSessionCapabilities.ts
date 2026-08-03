"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type SessionCapabilities = {
  isAdmin: boolean;
  isGerencia: boolean;
  canApprove: boolean;
  canManageCatalogs: boolean;
};

export type SessionUsuario = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  granjaId: string;
};

type SessionState = {
  loading: boolean;
  usuario: SessionUsuario | null;
  roles: string[];
  capabilities: SessionCapabilities;
};

const DEFAULT_CAPS: SessionCapabilities = {
  isAdmin: false,
  isGerencia: false,
  canApprove: false,
  canManageCatalogs: false,
};

const DEFAULT_STATE: SessionState = {
  loading: true,
  usuario: null,
  roles: [],
  capabilities: DEFAULT_CAPS,
};

let cachedSession: SessionState | null = null;
let inflight: Promise<SessionState> | null = null;
let cacheVersion = 0;
const listeners = new Set<() => void>();

function emit() {
  cacheVersion += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cacheVersion;
}

async function fetchSession(force = false): Promise<SessionState> {
  if (!force && cachedSession && !cachedSession.loading) {
    return cachedSession;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (!res.ok) {
        const next: SessionState = {
          loading: false,
          usuario: null,
          roles: [],
          capabilities: DEFAULT_CAPS,
        };
        cachedSession = next;
        emit();
        return next;
      }
      const data = (await res.json()) as {
        usuario: SessionUsuario;
        roles: string[];
        capabilities: SessionCapabilities;
      };
      const next: SessionState = {
        loading: false,
        usuario: data.usuario,
        roles: data.roles ?? [],
        capabilities: data.capabilities ?? DEFAULT_CAPS,
      };
      cachedSession = next;
      emit();
      return next;
    } catch {
      const next: SessionState = {
        loading: false,
        usuario: null,
        roles: [],
        capabilities: DEFAULT_CAPS,
      };
      cachedSession = next;
      emit();
      return next;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Capacidades de la sesión (admin vs gerencia).
 * Single-flight + caché en memoria: Sidebar/Admin/Mensajería comparten un fetch.
 */
export function useSessionCapabilities() {
  useSyncExternalStore(subscribe, getSnapshot, () => 0);

  useEffect(() => {
    void fetchSession(false);
  }, []);

  const refresh = useCallback(async () => {
    await fetchSession(true);
  }, []);

  const state = cachedSession ?? DEFAULT_STATE;
  return { ...state, refresh };
}
