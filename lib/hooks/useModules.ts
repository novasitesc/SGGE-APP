"use client";

import { useCallback, useState } from "react";
import type { Module } from "@/lib/types/domain";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import {
  createModule,
  deleteModuleApi,
  fetchModules,
  updateModuleApi,
} from "@/lib/api/data-client";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";

function invalidateModuleRelated() {
  invalidateApiCacheMany(["modules", "dashboard", "animals"]);
}

export function useModules() {
  const { loteId, loading: loteLoading } = useActiveLote();
  const cacheKey = loteId ? `modules:${loteId}` : "modules";
  const loader = useCallback(() => fetchModules(loteId), [loteId]);
  const { data, loading, error, reload } = useApiQuery(cacheKey, loader, [
    loteId,
  ], { enabled: !!loteId });
  const modules = (data ?? []) as Module[];

  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const addModule = async (payload: {
    name: string;
    type?: string;
    capacity: number;
  }) => {
    setMutating(true);
    setActionError(null);
    try {
      const created = await createModule(payload);
      invalidateModuleRelated();
      await reload();
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear módulo";
      setActionError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const updateModule = async (
    id: string,
    payload: Parameters<typeof updateModuleApi>[1]
  ) => {
    const mod = modules.find((m) => m.id === id);
    if (!mod?.uuid) throw new Error("Módulo no encontrado");
    setMutating(true);
    setActionError(null);
    try {
      const updated = await updateModuleApi(mod.uuid, payload);
      invalidateModuleRelated();
      await reload();
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al actualizar módulo";
      setActionError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  const removeModule = async (id: string) => {
    const mod = modules.find((m) => m.id === id);
    if (!mod?.uuid) throw new Error("Módulo no encontrado");
    setMutating(true);
    setActionError(null);
    try {
      await deleteModuleApi(mod.uuid);
      invalidateModuleRelated();
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al eliminar módulo";
      setActionError(msg);
      throw e;
    } finally {
      setMutating(false);
    }
  };

  return {
    modules,
    loading: loteLoading || loading,
    error,
    mutating,
    actionError,
    clearActionError: () => setActionError(null),
    reload,
    addModule,
    updateModule,
    removeModule,
  };
}
