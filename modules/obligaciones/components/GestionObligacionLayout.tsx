"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type KpiItem = {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
};

export function GestionObligacionLayout({
  title,
  description,
  icon: Icon,
  iconClass,
  kpis,
  onAdd,
  addLabel,
  extraActions,
  error,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  kpis: KpiItem[];
  onAdd?: () => void;
  addLabel?: string;
  extraActions?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/gestion"
            className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${iconClass}`} />
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {addLabel ?? "Nuevo"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={kpi.alert ? "border-amber-300" : undefined}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <p
                className={`text-lg font-bold mt-0.5 tabular-nums ${
                  kpi.alert ? "text-amber-700" : ""
                }`}
              >
                {kpi.value}
              </p>
              {kpi.hint && (
                <p className="text-[11px] text-muted-foreground mt-1">{kpi.hint}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {children}
    </div>
  );
}
