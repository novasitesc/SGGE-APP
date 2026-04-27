import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { modules, animals } from "@/lib/mockData";
import { Grid3X3, Users, MapPin, User } from "lucide-react";

const typeConfig = {
  engorda: { label: "Engorda", color: "bg-emerald-100 text-emerald-800" },
  leche: { label: "Leche", color: "bg-blue-100 text-blue-800" },
  "cría": { label: "Cría", color: "bg-pink-100 text-pink-800" },
  "recría": { label: "Recría", color: "bg-amber-100 text-amber-800" },
};

export default function ModulesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Módulos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {modules.length} módulos activos · {animals.filter((a) => a.status === "activo").length} animales en producción
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Módulos</p>
            <p className="text-3xl font-bold mt-1">{modules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Capacidad Total</p>
            <p className="text-3xl font-bold mt-1">{modules.reduce((s, m) => s + m.capacity, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Animales Asignados</p>
            <p className="text-3xl font-bold mt-1 text-emerald-700">
              {modules.reduce((s, m) => s + m.animalCount, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ocupación Promedio</p>
            <p className="text-3xl font-bold mt-1 text-blue-700">
              {Math.round(
                (modules.reduce((s, m) => s + m.animalCount, 0) /
                  modules.reduce((s, m) => s + m.capacity, 0)) *
                  100
              )}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {modules.map((module) => {
          const occupancy = Math.round((module.animalCount / module.capacity) * 100);
          const moduleAnimals = animals.filter(
            (a) => a.moduleId === module.id && a.status === "activo"
          );
          const avgWeight =
            moduleAnimals.length > 0
              ? Math.round(moduleAnimals.reduce((s, a) => s + a.currentWeight, 0) / moduleAnimals.length)
              : 0;
          const typeConf = typeConfig[module.type];

          return (
            <Card key={module.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100">
                      <Grid3X3 className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{module.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{module.id}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeConf.color}`}>
                    {typeConf.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Occupancy bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Ocupación</span>
                    <span className="font-semibold">
                      {module.animalCount}/{module.capacity} animales ({occupancy}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        occupancy >= 90 ? "bg-red-500" : occupancy >= 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${occupancy}%` }}
                    />
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{module.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs">{module.supervisor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{moduleAnimals.length} activos</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peso prom.: </span>
                    <span className="font-semibold text-emerald-700">{avgWeight > 0 ? `${avgWeight} kg` : "—"}</span>
                  </div>
                </div>

                {/* Animal tags */}
                {moduleAnimals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                    {moduleAnimals.map((a) => (
                      <span
                        key={a.id}
                        className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-lg"
                      >
                        {a.tagId}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
