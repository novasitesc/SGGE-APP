"use client";

import { useCallback, useEffect, useState } from "react";
import type { Module } from "@/lib/types/domain";
import {
  createModule,
  deleteModuleApi,
  fetchModules,
  updateModuleApi,
} from "@/lib/api/data-client";

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModules(await fetchModules());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar módulos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addModule = async (data: {
    name: string;
    type?: string;
    capacity: number;
  }) => {
    setMutating(true);
    setActionError(null);
    try {
      const created = await createModule(data);
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
    data: Parameters<typeof updateModuleApi>[1]
  ) => {
    const mod = modules.find((m) => m.id === id);
    if (!mod?.uuid) throw new Error("Módulo no encontrado");
    setMutating(true);
    setActionError(null);
    try {
      const updated = await updateModuleApi(mod.uuid, data);
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
    loading,
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
