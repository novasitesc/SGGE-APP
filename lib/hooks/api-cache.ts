/** Caché en memoria con single-flight para lecturas API del cliente. */

export const DEFAULT_STALE_TIME_MS = 45_000;

type CacheEntry<T = unknown> = {
  data: T;
  updatedAt: number;
};

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

export function subscribeApiCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

export function getCached<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, updatedAt: Date.now() });
  notify();
}

export function isStale(
  entry: CacheEntry | undefined,
  staleTimeMs: number = DEFAULT_STALE_TIME_MS
): boolean {
  if (!entry) return true;
  return Date.now() - entry.updatedAt > staleTimeMs;
}

/**
 * Invalida una key exacta o todas las que empiezan con el prefijo
 * (p. ej. `invalidate("costs")` limpia `costs` y `costs:2026-01-01:...`).
 */
export function invalidateApiCache(keyOrPrefix: string): void {
  const exact = store.delete(keyOrPrefix);
  inflight.delete(keyOrPrefix);
  let removedPrefix = false;
  for (const key of [...store.keys()]) {
    if (key.startsWith(`${keyOrPrefix}:`) || key.startsWith(`${keyOrPrefix}/`)) {
      store.delete(key);
      inflight.delete(key);
      removedPrefix = true;
    }
  }
  if (exact || removedPrefix) notify();
}

export function invalidateApiCacheMany(keys: string[]): void {
  for (const key of keys) invalidateApiCache(key);
}

/** Ejecuta loader con single-flight: callers concurrentes comparten la misma Promise. */
export async function loadWithCache<T>(
  key: string,
  loader: () => Promise<T>,
  options?: { force?: boolean; staleTimeMs?: number }
): Promise<T> {
  const force = options?.force ?? false;
  const staleTimeMs = options?.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
  const existing = getCached<T>(key);

  if (!force && existing && !isStale(existing, staleTimeMs)) {
    return existing.data;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const data = await loader();
      setCached(key, data);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
