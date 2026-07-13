"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Eye,
  Grid3X3,
  Loader2,
  ScrollText,
  Search,
  Users,
} from "lucide-react";
import { useModules } from "@/lib/hooks/useModules";
import { useAnimals } from "@/lib/hooks/useAnimals";
import {
  moduleTypeColor,
  moduleTypeLabel,
} from "@/lib/modulos/constants";
import { STATUS_CONFIG } from "@/components/animales/types";
import { HistorialSistema } from "@/components/animales/HistorialAnimales";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnimalStatus } from "@/lib/types/domain";
import { formatDate } from "@/lib/utils";

type Props = {
  moduleCode: string;
};

type Tab = "animales" | "historial";

export function ModuloDetalleClient({ moduleCode }: Props) {
  const { modules, loading: loadingModules, error: modulesError } = useModules();
  const { animals, loading: loadingAnimals, error: animalsError } = useAnimals();
  const [tab, setTab] = useState<Tab>("animales");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<AnimalStatus | "todos">("todos");

  const mod = useMemo(
    () => modules.find((m) => m.id === moduleCode || m.uuid === moduleCode),
    [modules, moduleCode]
  );

  const moduleAnimals = useMemo(() => {
    if (!mod) return [];
    return animals.filter((a) => a.moduleId === mod.id);
  }, [animals, mod]);

  const filteredAnimals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return moduleAnimals.filter((a) => {
      const matchSearch =
        !q ||
        a.tagId.toLowerCase().includes(q) ||
        a.breed.toLowerCase().includes(q);
      const matchStatus = filterStatus === "todos" || a.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [moduleAnimals, search, filterStatus]);

  const activos = moduleAnimals.filter((a) => a.status === "activo");
  const avgWeight =
    activos.length > 0
      ? Math.round(
          activos.reduce((s, a) => s + a.currentWeight, 0) / activos.length
        )
      : 0;
  const loading = loadingModules || loadingAnimals;
  const error = modulesError ?? animalsError;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando módulo…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Módulo no encontrado</p>
            <p className="text-sm mt-1">
              No existe un módulo con código <span className="font-mono">{moduleCode}</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <BackLink />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Grid3X3 className="h-5 w-5 text-violet-600 shrink-0" />
              <h1 className="text-2xl font-bold tracking-tight truncate">{mod.name}</h1>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${moduleTypeColor(mod.type)}`}
              >
                {moduleTypeLabel(mod.type)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
              {mod.id}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200">
          <p className="text-2xl font-bold">{moduleAnimals.length}</p>
          <p className="text-sm font-medium mt-0.5">Animales (todos)</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 text-emerald-700 border-emerald-200">
          <p className="text-2xl font-bold">{activos.length}</p>
          <p className="text-sm font-medium mt-0.5">Activos</p>
        </div>
        <div className="rounded-xl border p-4 bg-violet-50 text-violet-700 border-violet-200">
          <p className="text-2xl font-bold">{mod.capacity}</p>
          <p className="text-sm font-medium mt-0.5">Capacidad</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 text-amber-700 border-amber-200">
          <p className="text-2xl font-bold">
            {avgWeight > 0 ? `${avgWeight} kg` : "—"}
          </p>
          <p className="text-sm font-medium mt-0.5">Peso prom. activos</p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <TabButton
          active={tab === "animales"}
          onClick={() => setTab("animales")}
          icon={<Users className="h-4 w-4" />}
          label={`Animales (${moduleAnimals.length})`}
        />
        <TabButton
          active={tab === "historial"}
          onClick={() => setTab("historial")}
          icon={<ScrollText className="h-4 w-4" />}
          label="Modificaciones"
        />
      </div>

      {tab === "animales" ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-600" />
                Inventario del módulo
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar arete o raza…"
                    className="pl-8 h-9 w-full sm:w-56"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(e.target.value as AnimalStatus | "todos")
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="enfermo">Enfermo</option>
                  <option value="vendido">Vendido</option>
                  <option value="muerto">Muerto</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredAnimals.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {moduleAnimals.length === 0
                  ? "Este módulo no tiene animales asignados."
                  : "Ningún animal coincide con el filtro."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Arete</TableHead>
                    <TableHead>Raza</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Peso actual</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnimals.map((animal) => {
                    const sc = STATUS_CONFIG[animal.status];
                    return (
                      <TableRow key={animal.id}>
                        <TableCell className="font-mono font-semibold text-xs">
                          {animal.tagId}
                        </TableCell>
                        <TableCell>{animal.breed}</TableCell>
                        <TableCell>{animal.sex === "M" ? "Macho" : "Hembra"}</TableCell>
                        <TableCell className="font-medium">
                          {animal.currentWeight} kg
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(animal.entryDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/gestion/animales/${animal.id}?from=modules&module=${encodeURIComponent(mod.id)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver ficha
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <HistorialSistema
          title="Modificaciones del módulo"
          subtitle={`Altas, cambios y bajas del corral ${mod.id} — ${mod.name}`}
          defaultModulo="modulos"
          registroId={mod.uuid}
          compact
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/modules"
      className="flex items-center justify-center w-8 h-8 rounded-lg border hover:bg-muted transition-colors shrink-0"
    >
      <ChevronLeft className="h-4 w-4" />
    </Link>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-violet-600 text-violet-700"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
