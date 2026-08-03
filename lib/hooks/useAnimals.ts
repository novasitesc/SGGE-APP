"use client";

import type { AnimalDetail } from "@/components/animales/types";
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
  const { data, loading, error, reload, mutate } = useApiQuery(
    "animals",
    fetchAnimals
  );
  const animals = data ?? [];

  const afterMutation = (next: typeof animals) => {
    mutate(next);
    invalidateApiCacheMany(["animals", "dashboard", "modules", "weights"]);
    setCached("animals", next);
  };

  const addAnimal = async (payload: Parameters<typeof createAnimal>[0]) => {
    const created = await createAnimal(payload);
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
    loading,
    error,
    reload,
    addAnimal,
    updateAnimal,
    requestAnimalDeletion,
    getAnimalDetail,
  };
}
