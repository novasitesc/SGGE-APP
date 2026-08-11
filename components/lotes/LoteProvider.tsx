"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchLotesAdmin, type LoteAdmin } from "@/lib/api/data-client";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import {
  loteLabel,
  pickDefaultLoteId,
  readStoredLoteId,
  writeStoredLoteId,
  type LoteOption,
} from "@/lib/lotes/active-lote";

type LoteContextValue = {
  lotes: LoteOption[];
  loteId: string | null;
  lote: LoteOption | null;
  loading: boolean;
  error: string | null;
  setLoteId: (id: string) => void;
  reloadLotes: () => Promise<void>;
};

const LoteContext = createContext<LoteContextValue | null>(null);

const LOTE_SCOPED_CACHE_KEYS = [
  "animals",
  "dashboard",
  "modules",
  "weights",
  "feeding",
];

export function LoteProvider({ children }: { children: React.ReactNode }) {
  const [lotes, setLotes] = useState<LoteOption[]>([]);
  const [loteId, setLoteIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadLotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows: LoteAdmin[] = await fetchLotesAdmin();
      const options: LoteOption[] = rows.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        estado: r.estado,
      }));
      setLotes(options);
      const next = pickDefaultLoteId(options, readStoredLoteId());
      setLoteIdState(next);
      writeStoredLoteId(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los lotes");
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLotes();
  }, [reloadLotes]);

  const setLoteId = useCallback((id: string) => {
    setLoteIdState((prev) => {
      if (prev === id) return prev;
      writeStoredLoteId(id);
      invalidateApiCacheMany(LOTE_SCOPED_CACHE_KEYS);
      return id;
    });
  }, []);

  const lote = useMemo(
    () => lotes.find((l) => l.id === loteId) ?? null,
    [lotes, loteId]
  );

  const value = useMemo<LoteContextValue>(
    () => ({
      lotes,
      loteId,
      lote,
      loading,
      error,
      setLoteId,
      reloadLotes,
    }),
    [lotes, loteId, lote, loading, error, setLoteId, reloadLotes]
  );

  return <LoteContext.Provider value={value}>{children}</LoteContext.Provider>;
}

export function useActiveLote(): LoteContextValue {
  const ctx = useContext(LoteContext);
  if (!ctx) {
    throw new Error("useActiveLote debe usarse dentro de LoteProvider");
  }
  return ctx;
}

export function useActiveLoteLabel(): string {
  const { lote } = useActiveLote();
  return loteLabel(lote);
}
