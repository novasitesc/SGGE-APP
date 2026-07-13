"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cost } from "@/lib/types/domain";
import {
  createCost,
  deleteCostApi,
  fetchCosts,
  updateCostApi,
} from "@/lib/api/data-client";

export function useCosts() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCosts(await fetchCosts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar costos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCost = async (data: Parameters<typeof createCost>[0]) => {
    const created = await createCost(data);
    setCosts((prev) => [created, ...prev]);
    return created;
  };

  const updateCost = async (id: string, data: Parameters<typeof updateCostApi>[1]) => {
    const updated = await updateCostApi(id, data);
    setCosts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const removeCost = async (id: string) => {
    await deleteCostApi(id);
    setCosts((prev) => prev.filter((c) => c.id !== id));
  };

  return { costs, loading, error, reload, addCost, updateCost, removeCost };
}
