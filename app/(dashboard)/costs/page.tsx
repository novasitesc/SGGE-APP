"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { aggregateCostsByCategory, fetchCosts } from "@/lib/api/data-client";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import {
  costCategoryLabel,
  normalizeCostCategoryKey,
} from "@/lib/costs/categories";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";
import { FileText, Receipt, TrendingDown } from "lucide-react";

export default function CostsPage() {
  const { data: costs, loading } = useApiQuery(fetchCosts);
  const list = costs ?? [];
  const [filterSource, setFilterSource] = useState<string>("todas");

  const filtered = useMemo(() => {
    if (filterSource === "todas") return list;
    if (filterSource === "comprobante") {
      return list.filter((c) => c.source === "comprobante");
    }
    return list.filter((c) => (c.source ?? "manual") === "manual");
  }, [list, filterSource]);

  const costsByCategory = aggregateCostsByCategory(filtered);
  const totalCost = filtered.reduce((s, c) => s + c.amount, 0);
  const fromInvoice = list.filter((c) => c.source === "comprobante").length;

  const highlightCats = [
    { cat: "alimentación", label: "Alimentación" },
    { cat: "mano_de_obra", label: "Mano de Obra" },
    { cat: "otros", label: "Otros" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gastos operativos y procedentes de facturas · {fromInvoice} desde
            comprobante
          </p>
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
        >
          <option value="todas">Todos los orígenes</option>
          <option value="comprobante">Desde factura</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Costo Total
            </p>
            <p className="text-2xl font-bold mt-1 text-red-700">
              {formatCurrency(totalCost)}
            </p>
          </CardContent>
        </Card>
        {highlightCats.map(({ cat, label }) => {
          const catTotal = filtered
            .filter((c) => normalizeCostCategoryKey(c.category) === cat)
            .reduce((s, c) => s + c.amount, 0);
          return (
            <Card key={cat}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(catTotal)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalCost > 0
                    ? `${((catTotal / totalCost) * 100).toFixed(0)}% del total`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Costos por Categoría</CardTitle>
            <CardDescription>Distribución acumulada del ciclo</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[260px] animate-pulse bg-muted/30 rounded-xl" />
            ) : costsByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">
                No hay gastos registrados.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={costsByCategory}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
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
                    tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), "Monto"]}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {costsByCategory.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumen por Rubro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {costsByCategory.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm">{cat.category}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(cat.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalCost > 0
                      ? `${((cat.amount / totalCost) * 100).toFixed(1)}%`
                      : "—"}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Registro de Gastos
          </CardTitle>
          <CardDescription>
            Incluye altas manuales y gastos confirmados desde{" "}
            <Link href="/gestion/comprobantes" className="text-primary underline-offset-2 hover:underline">
              Comprobantes
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted/30 rounded-xl" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay gastos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(cost.date)}
                    </TableCell>
                    <TableCell>
                      {cost.source === "comprobante" ? (
                        <Badge variant="info" className="gap-1">
                          <FileText className="h-3 w-3" />
                          Factura
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{costCategoryLabel(cost.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{cost.description}</p>
                      {cost.issuer && (
                        <p className="text-xs text-muted-foreground">{cost.issuer}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(cost.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end pt-4 border-t mt-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total registrado</p>
              <p className="text-xl font-bold text-red-700">
                {formatCurrency(totalCost)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
