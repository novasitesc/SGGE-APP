"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cost } from "@/lib/types/domain";
import {
  createCost,
  deleteCostApi,
  fetchCosts,
  updateCostApi,
  type FetchCostsParams,
} from "@/lib/api/data-client";

export function useCosts(params?: FetchCostsParams) {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const from = params?.from ?? null;
  const to = params?.to ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCosts(await fetchCosts({ from, to }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar costos");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCost = async (data: Parameters<typeof createCost>[0]) => {
    setMutating(true);
    setError(null);
    try {
      const created = await createCost(data);
      setCosts((prev) => [created, ...prev]);
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear costo";
      setError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const updateCost = async (
    id: string,
    data: Parameters<typeof updateCostApi>[1]
  ) => {
    setMutating(true);
    setError(null);
    try {
      const updated = await updateCostApi(id, data);
      setCosts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al actualizar costo";
      setError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const removeCost = async (id: string) => {
    setMutating(true);
    setError(null);
    try {
      await deleteCostApi(id);
      setCosts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al eliminar costo";
      setError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  return {
    costs,
    loading,
    error,
    mutating,
    reload,
    addCost,
    updateCost,
    removeCost,
    setError,
  };
}
