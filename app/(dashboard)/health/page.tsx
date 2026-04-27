import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { treatments, healthAlerts } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/utils";
import { HeartPulse, AlertTriangle, Syringe, Shield, Pill } from "lucide-react";

const treatmentTypeConfig = {
  vacuna: { label: "Vacuna", variant: "info" as const, icon: "💉" },
  desparasitante: { label: "Desparasitante", variant: "success" as const, icon: "🦠" },
  implante: { label: "Implante", variant: "secondary" as const, icon: "📌" },
  "anabólico": { label: "Anabólico", variant: "warning" as const, icon: "⚡" },
  vitamina: { label: "Vitamina", variant: "outline" as const, icon: "🌿" },
  antibiótico: { label: "Antibiótico", variant: "destructive" as const, icon: "🔬" },
};

const alertPriorityConfig = {
  alta: { variant: "destructive" as const, dot: "bg-red-500" },
  media: { variant: "warning" as const, dot: "bg-amber-500" },
  baja: { variant: "secondary" as const, dot: "bg-gray-400" },
};

export default function HealthPage() {
  const totalTreatmentCost = treatments.reduce((s, t) => s + t.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salud</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control sanitario, tratamientos y alertas del hato
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Syringe className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tratamientos</p>
                <p className="text-2xl font-bold">{treatments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold text-red-600">
                  {healthAlerts.filter((a) => a.priority === "alta").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vacunas Aplicadas</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {treatments.filter((t) => t.type === "vacuna").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Pill className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo Sanitario</p>
                <p className="text-lg font-bold text-violet-700">{formatCurrency(totalTreatmentCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alertas y Recordatorios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {healthAlerts.map((alert) => {
              const priority = alertPriorityConfig[alert.priority];
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${priority.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {alert.tagId && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {alert.tagId}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Vence: {formatDate(alert.dueDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={priority.variant}>{alert.priority}</Badge>
                    <Badge variant="outline">{alert.type}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Treatments table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose-600" />
            Historial de Tratamientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tratamiento</TableHead>
                <TableHead className="hidden md:table-cell">Animales</TableHead>
                <TableHead className="hidden lg:table-cell">Aplicado por</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead className="hidden lg:table-cell">Próxima Aplicación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treatments.map((t) => {
                const conf = treatmentTypeConfig[t.type];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>{conf.icon}</span>
                        <Badge variant={conf.variant}>{conf.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.notes}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {t.animalCount} animales
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {t.appliedBy}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(t.totalCost)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {t.nextDue ? (
                        <span className="text-amber-600 font-medium">{formatDate(t.nextDue)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end pt-4 border-t mt-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Costo sanitario total</p>
              <p className="text-xl font-bold text-violet-700">{formatCurrency(totalTreatmentCost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
