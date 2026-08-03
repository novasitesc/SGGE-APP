"use client";

import { useMemo, useState } from "react";
import type { Treatment } from "@/lib/types/domain";

export function useSaludFilters(list: Treatment[]) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay =
          t.name.toLowerCase().includes(qq) ||
          t.appliedBy.toLowerCase().includes(qq) ||
          String(t.type).toLowerCase().includes(qq) ||
          t.notes.toLowerCase().includes(qq);
        if (!hay) return false;
      }
      return true;
    });
  }, [list, typeFilter, from, to, q]);

  return { q, setQ, typeFilter, setTypeFilter, from, setFrom, to, setTo, filtered };
}
