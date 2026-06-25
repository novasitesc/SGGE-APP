"use client";

import { useCallback, useEffect, useState } from "react";
import type { Animal } from "@/lib/mockData";
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

export function useAnimals() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnimals(await fetchAnimals());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar animales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addAnimal = async (data: Parameters<typeof createAnimal>[0]) => {
    const created = await createAnimal(data);
    setAnimals((prev) => [...prev, created].sort((a, b) => a.tagId.localeCompare(b.tagId)));
    return created;
  };

  const updateAnimal = async (
    id: string,
    updates: Parameters<typeof updateAnimalApi>[1]
  ) => {
    const updated = await updateAnimalApi(id, updates);
    setAnimals((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
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
