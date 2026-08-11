
import { requireApiContext } from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";
import { getEstadoIdByCodigo } from "@/lib/api/corrales-helpers";

export const dynamic = "force-dynamic";

type MonthBucket = { key: string; label: string; sum: number; n: number };

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const loteId = url.searchParams.get("loteId")?.trim() || null;

    let animalsQuery = admin
      .from("animales")
      .select("id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null);
    if (loteId) animalsQuery = animalsQuery.eq("lote_id", loteId);

    const { data: animals } = await animalsQuery;
    const ids = (animals ?? []).map((a: { id: string }) => a.id);
    if (ids.length === 0) {
      return jsonOk({
        weightHistory: [] as { month: string; avgWeight: number; totalWeight: number }[],
      });
    }

    const { data: measurements, error } = await admin
      .from("pesajes")
      .select("animal_id, fecha_pesaje, peso_kg")
      .in("animal_id", ids)
      .is("deleted_at", null)
      .order("fecha_pesaje", { ascending: true });
    if (error) throw new Error(error.message);

    const buckets = new Map<string, MonthBucket>();
    for (const m of measurements ?? []) {
      const d = new Date((m as { fecha_pesaje: string }).fecha_pesaje + "T12:00:00Z");
      const key = monthKey(d);
      const label = monthLabel(d);
      const w = Number((m as { peso_kg: number }).peso_kg);
      const cur = buckets.get(key) ?? { key, label, sum: 0, n: 0 };
      cur.sum += w;
      cur.n += 1;
      buckets.set(key, cur);
    }

    let series: { month: string; avgWeight: number; totalWeight: number }[] = [];
    if (buckets.size > 0) {
      series = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({
          month: v.label,
          avgWeight: Math.round((v.sum / v.n) * 10) / 10,
          totalWeight: Math.round(v.sum * 10) / 10,
        }));
    } else {
      const estadoActivo = await getEstadoIdByCodigo(admin, "activo");
      let actQuery = admin
        .from("animales")
        .select("peso_actual_kg")
        .eq("granja_id", granjaId)
        .eq("estado_id", estadoActivo)
        .is("deleted_at", null);
      if (loteId) actQuery = actQuery.eq("lote_id", loteId);
      const { data: act } = await actQuery;
      const list = act ?? [];
      const n = list.length;
      if (n > 0) {
        const total = list.reduce(
          (s: number, a: { peso_actual_kg: number }) =>
            s + Number(a.peso_actual_kg),
          0
        );
        series = [
          {
            month: monthLabel(new Date()),
            avgWeight: Math.round((total / n) * 10) / 10,
            totalWeight: Math.round(total * 10) / 10,
          },
        ];
      }
    }

    return jsonOk({ weightHistory: series });
  } catch (e) {
    return jsonServerError("weights/history", e);
  }
}
