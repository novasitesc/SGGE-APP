"use client";

import type { Sale } from "@/lib/types/domain";
import { fetchSales } from "@/lib/api/data-client";
import { invalidateApiCacheMany } from "@/lib/hooks/api-cache";
import { useApiQuery } from "@/lib/hooks/useApiQuery";

export function useSales() {
  const { data, loading, error, reload } = useApiQuery("sales", fetchSales);

  const invalidateRelated = () => {
    invalidateApiCacheMany(["sales", "dashboard", "animals", "reports", "modules"]);
  };

  return {
    sales: (data ?? []) as Sale[],
    loading,
    error,
    reload,
    invalidateRelated,
  };
}
