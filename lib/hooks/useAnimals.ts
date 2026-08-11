"use client";

import { useCallback } from "react";
import type { AnimalDetail } from "@/components/animales/types";
import { useActiveLote } from "@/components/lotes/LoteProvider";
import {
  createAnimal,
  fetchAnimalById,
  fetchAnimals,
  updateAnimalApi,
} from "@/lib/api/animals-client";
import {
  requestAnimalDeletionApi,
  type AnimalDeleteRequestPayload,
} from "@/lib/api/solicitudes-client";
import { invalidateApiCacheMany, setCached } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";

export function useAnimals() {
  const { loteId, loading: loteLoading } = useActiveLote();
  const cacheKey = loteId ? `animals:${loteId}` : "animals";
  const loader = useCallback(
    () => fetchAnimals(loteId),
    [loteId]
  );
  const { data, loading, error, reload, mutate } = useApiQuery(
    cacheKey,
    loader,
    [loteId],
    { enabled: !!loteId }
  );
  const animals = data ?? [];

  const afterMutation = (next: typeof animals) => {
    mutate(next);
    invalidateApiCacheMany(["animals", "dashboard", "modules", "weights"]);
    setCached(cacheKey, next);
  };

  const addAnimal = async (payload: Parameters<typeof createAnimal>[0]) => {
    const created = await createAnimal({
      ...payload,
      loteId: payload.loteId ?? loteId ?? undefined,
    });
    afterMutation(
      [...animals, created].sort((a, b) => a.tagId.localeCompare(b.tagId))
    );
    return created;
  };

  const updateAnimal = async (
    id: string,
    updates: Parameters<typeof updateAnimalApi>[1]
  ) => {
    const updated = await updateAnimalApi(id, updates);
    afterMutation(animals.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    return updated;
  };

  const requestAnimalDeletion = async (
    id: string,
    payload: AnimalDeleteRequestPayload
  ) => {
    return requestAnimalDeletionApi(id, payload);
  };

  const getAnimalDetail = async (id: string): Promise<AnimalDetail> => {
    return fetchAnimalById(id);
  };

  return {
    animals,
    loading: loteLoading || loading,
    error,
    reload,
    addAnimal,
    updateAnimal,
    requestAnimalDeletion,
    getAnimalDetail,
  };
}
