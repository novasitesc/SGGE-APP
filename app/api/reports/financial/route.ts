
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

function monthKeyFromDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${months[(m ?? 1) - 1]} ${y}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;

    const [{ data: gastos }, { data: ventas }] = await Promise.all([
      admin
        .from("gastos")
        .select("monto, fecha")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
      admin
        .from("ventas")
        .select("monto_total, fecha_venta")
        .eq("granja_id", granjaId)
        .is("deleted_at", null),
    ]);

    const byMonth = new Map<string, { costs: number; revenue: number }>();

    for (const c of gastos ?? []) {
      const key = monthKeyFromDate((c as { fecha: string }).fecha);
      const cur = byMonth.get(key) ?? { costs: 0, revenue: 0 };
      cur.costs += Number((c as { monto: number }).monto);
      byMonth.set(key, cur);
    }
    for (const s of ventas ?? []) {
      const key = monthKeyFromDate((s as { fecha_venta: string }).fecha_venta);
      const cur = byMonth.get(key) ?? { costs: 0, revenue: 0 };
      cur.revenue += Number((s as { monto_total: number }).monto_total);
      byMonth.set(key, cur);
    }

    const monthlyFinancials = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: labelFromKey(key),
        costs: Math.round(v.costs * 100) / 100,
        revenue: Math.round(v.revenue * 100) / 100,
        profit: Math.round((v.revenue - v.costs) * 100) / 100,
      }));

    return jsonOk({ monthlyFinancials });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
