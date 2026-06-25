"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sale } from "@/lib/types/domain";
import { fetchSales } from "@/lib/api/data-client";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSales(await fetchSales());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sales, loading, error, reload };
}
