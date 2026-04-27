"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { costs, costsByCategory } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Receipt, TrendingDown } from "lucide-react";

const categoryConfig: Record<string, { label: string; variant: "default" | "secondary" | "success" | "info" | "warning" | "destructive" | "outline" }> = {
  alimentación: { label: "Alimentación", variant: "success" },
  transporte: { label: "Transporte", variant: "warning" },
  vacunas: { label: "Vacunas", variant: "info" },
  mano_de_obra: { label: "Mano de Obra", variant: "secondary" },
  servicios: { label: "Servicios", variant: "outline" },
  medicamentos: { label: "Medicamentos", variant: "destructive" },
  otros: { label: "Otros", variant: "default" },
};

export default function CostsPage() {
  const totalCost = costs.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Costos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control y seguimiento de gastos operativos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Costo Total</p>
            <p className="text-2xl font-bold mt-1 text-red-700">{formatCurrency(totalCost)}</p>
          </CardContent>
        </Card>
        {[
          { cat: "alimentación", label: "Alimentación" },
          { cat: "mano_de_obra", label: "Mano de Obra" },
          { cat: "transporte", label: "Transporte" },
        ].map(({ cat, label }) => {
          const catTotal = costs.filter((c) => c.category === cat).reduce((s, c) => s + c.amount, 0);
          return (
            <Card key={cat}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(catTotal)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {((catTotal / totalCost) * 100).toFixed(0)}% del total
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Costos por Categoría</CardTitle>
            <CardDescription>Distribución acumulada del ciclo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={costsByCategory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {costsByCategory.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumen por Rubro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {costsByCategory.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm">{cat.category}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(cat.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {((cat.amount / totalCost) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Total
              </span>
              <span className="text-red-700">{formatCurrency(totalCost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Costs table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Registro de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="hidden md:table-cell">Animales</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((cost) => {
                const conf = categoryConfig[cost.category] ?? { label: cost.category, variant: "default" as const };
                return (
                  <TableRow key={cost.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(cost.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{cost.description}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {cost.animalCount ? `${cost.animalCount} animales` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(cost.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end pt-4 border-t mt-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total registrado</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


