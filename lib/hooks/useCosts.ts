"use client";

import { useState } from "react";
import type { Cost } from "@/lib/types/domain";
import {
  createCost,
  deleteCostApi,
  fetchCosts,
  updateCostApi,
  type FetchCostsParams,
} from "@/lib/api/data-client";
import { invalidateApiCacheMany, setCached } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";

function costsCacheKey(from: string | null, to: string | null) {
  return `costs:${from ?? "all"}:${to ?? "all"}`;
}

export function useCosts(params?: FetchCostsParams) {
  const from = params?.from ?? null;
  const to = params?.to ?? null;
  const key = costsCacheKey(from, to);

  const { data, loading, error, reload, mutate } = useApiQuery(
    key,
    () => fetchCosts({ from, to }),
    [from, to]
  );

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const costs = (data ?? []) as Cost[];
  const combinedError = mutationError ?? error;

  const afterMutation = (next: Cost[]) => {
    mutate(next);
    // Limpia otras vistas de costos + KPIs; re-escribe la key actual
    invalidateApiCacheMany(["costs", "dashboard", "reports"]);
    setCached(key, next);
  };

  const addCost = async (payload: Parameters<typeof createCost>[0]) => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await createCost(payload);
      afterMutation([created, ...costs]);
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear costo";
      setMutationError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const updateCost = async (
    id: string,
    payload: Parameters<typeof updateCostApi>[1]
  ) => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await updateCostApi(id, payload);
      afterMutation(costs.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al actualizar costo";
      setMutationError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const removeCost = async (id: string) => {
    setMutating(true);
    setMutationError(null);
    try {
      await deleteCostApi(id);
      afterMutation(costs.filter((c) => c.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al eliminar costo";
      setMutationError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  return {
    costs,
    loading,
    error: combinedError,
    mutating,
    reload,
    addCost,
    updateCost,
    removeCost,
    setError: setMutationError,
  };
}
