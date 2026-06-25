"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHistorial, type HistorialListResponse } from "@/lib/api/historial-client";
import type { HistorialFilters } from "@/components/animales/historial-types";

const PAGE_SIZE = 30;

type Options = {
  defaultModulo?: string;
  registroId?: string;
};

export function useHistorialSistema(options: Options = {}) {
  const [data, setData] = useState<HistorialListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistorialFilters>({
    referencia: "",
    modulo: options.defaultModulo ?? "",
    accion: "",
    desde: "",
    hasta: "",
  });
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHistorial({
        referencia: filters.referencia || undefined,
        modulo: filters.modulo || undefined,
        accion: filters.accion || undefined,
        desde: filters.desde || undefined,
        hasta: filters.hasta || undefined,
        registroId: options.registroId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar historial");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page, options.registroId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = (next: HistorialFilters) => {
    setPage(0);
    setFilters(next);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    filters,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    setPage,
    applyFilters,
    reload: load,
  };
}

/** @deprecated Usar useHistorialSistema */
export function useHistorialAnimales(defaultModulo = "animales") {
  return useHistorialSistema({ defaultModulo });
}
