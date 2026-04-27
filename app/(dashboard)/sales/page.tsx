"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sales } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShoppingCart, Scale, TrendingUp, Banknote } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const monthlyRevenue = [
  { month: "Dic 2024", revenue: 19380 },
  { month: "Ene 2025", revenue: 37515 },
  { month: "Feb 2025", revenue: 38041 },
  { month: "Mar 2025", revenue: 39076 },
];

export default function SalesPage() {
  const totalRevenue = sales.reduce((s, v) => s + v.totalRevenue, 0);
  const totalWeight = sales.reduce((s, v) => s + v.finalWeight, 0);
  const avgPricePerKg = sales.reduce((s, v) => s + v.pricePerKg, 0) / sales.length;
  const avgRevenue = totalRevenue / sales.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Registro y análisis de ventas de ganado
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos Totales</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Animales Vendidos</p>
                <p className="text-2xl font-bold">{sales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Scale className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Precio Prom./kg</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(avgPricePerKg)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingreso Prom./animal</p>
                <p className="text-lg font-bold text-violet-700">{formatCurrency(avgRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Ingresos"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#16a34a", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas de Ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Kg totales vendidos", value: `${totalWeight.toLocaleString()} kg`, color: "text-foreground" },
                { label: "Precio mínimo/kg", value: formatCurrency(Math.min(...sales.map((s) => s.pricePerKg))), color: "text-amber-700" },
                { label: "Precio máximo/kg", value: formatCurrency(Math.max(...sales.map((s) => s.pricePerKg))), color: "text-green-700" },
                { label: "Peso promedio vendido", value: `${Math.round(totalWeight / sales.length)} kg`, color: "text-blue-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 rounded-xl bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Compradores</p>
              <div className="space-y-1.5">
                {Array.from(new Set(sales.map((s) => s.buyer))).map((buyer) => {
                  const buyerSales = sales.filter((s) => s.buyer === buyer);
                  const buyerRevenue = buyerSales.reduce((s, v) => s + v.totalRevenue, 0);
                  return (
                    <div key={buyer} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate">{buyer}</span>
                      <span className="font-semibold text-green-700 shrink-0 ml-2">{formatCurrency(buyerRevenue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            Registro de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Arete</TableHead>
                <TableHead>Raza</TableHead>
                <TableHead className="hidden md:table-cell">Módulo</TableHead>
                <TableHead>Peso Final</TableHead>
                <TableHead className="hidden sm:table-cell">Precio/kg</TableHead>
                <TableHead className="text-right">Ingreso Total</TableHead>
                <TableHead className="hidden lg:table-cell">Comprador</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono font-semibold text-xs">{sale.tagId}</TableCell>
                  <TableCell className="font-medium">{sale.breed}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-lg font-medium">{sale.moduleId}</span>
                  </TableCell>
                  <TableCell className="font-semibold">{sale.finalWeight} kg</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatCurrency(sale.pricePerKg)}/kg</TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    {formatCurrency(sale.totalRevenue)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {sale.buyer}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {formatDate(sale.saleDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end pt-4 border-t mt-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total ingresos</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


