"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_STALE_TIME_MS,
  getCached,
  isStale,
  loadWithCache,
  setCached,
  subscribeApiCache,
} from "@/lib/hooks/api-cache";

export type UseApiQueryOptions = {
  staleTimeMs?: number;
  enabled?: boolean;
};

export function useApiQuery<T>(
  key: string,
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options?: UseApiQueryOptions
) {
  const staleTimeMs = options?.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
  const enabled = options?.enabled ?? true;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const cacheVersion = useSyncExternalStore(
    subscribeApiCache,
    () => {
      const entry = getCached<T>(key);
      return entry ? `${key}:${entry.updatedAt}` : `${key}:empty`;
    },
    () => `${key}:ssr`
  );

  const cached = enabled ? getCached<T>(key) : undefined;
  const [data, setData] = useState<T | null>(() => cached?.data ?? null);
  const [loading, setLoading] = useState(() => enabled && !cached);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const entry = getCached<T>(key);
    if (entry) {
      setData(entry.data);
      setLoading(false);
    }
    void cacheVersion;
  }, [key, enabled, cacheVersion]);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const entry = getCached<T>(key);
    if (entry) {
      setData(entry.data);
      setLoading(false);
      setRevalidating(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const next = await loadWithCache(key, () => loaderRef.current(), {
        force: true,
        staleTimeMs,
      });
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
      setRevalidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, staleTimeMs, ...deps]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const entry = getCached<T>(key);

    if (entry) {
      setData(entry.data);
      setLoading(false);
      if (!isStale(entry, staleTimeMs)) return;

      setRevalidating(true);
      void loadWithCache(key, () => loaderRef.current(), {
        force: false,
        staleTimeMs,
      })
        .then((next) => {
          if (!cancelled) {
            setData(next);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Error al cargar datos");
          }
        })
        .finally(() => {
          if (!cancelled) setRevalidating(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    void loadWithCache(key, () => loaderRef.current(), {
      force: false,
      staleTimeMs,
    })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar datos");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, staleTimeMs, ...deps]);

  const mutate = useCallback(
    (next: T | ((prev: T | null) => T)) => {
      const value =
        typeof next === "function"
          ? (next as (prev: T | null) => T)(getCached<T>(key)?.data ?? data)
          : next;
      setCached(key, value);
      setData(value);
    },
    [key, data]
  );

  return {
    data,
    loading: enabled ? loading : false,
    revalidating,
    error,
    reload,
    mutate,
  };
}
