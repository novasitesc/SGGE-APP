import { requireApiContext } from "@/lib/api/auth";
import { jsonOk, jsonServerError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export type SearchHit = {
  type: "animal" | "modulo";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 1) return jsonOk({ items: [] as SearchHit[] });

    const term = q.replace(/[%_,]/g, "").slice(0, 40);
    if (!term) return jsonOk({ items: [] as SearchHit[] });
    const pattern = `%${term}%`;

    const [{ data: animals, error: e1 }, { data: modules, error: e2 }] =
      await Promise.all([
        admin
          .from("animales")
          .select("id, arete, estados_animales ( codigo, nombre ), corrales ( codigo )")
          .eq("granja_id", granjaId)
          .is("deleted_at", null)
          .ilike("arete", pattern)
          .order("arete", { ascending: true })
          .limit(8),
        admin
          .from("corrales")
          .select("id, codigo, nombre, tipo")
          .eq("granja_id", granjaId)
          .is("deleted_at", null)
          .or(`codigo.ilike.${pattern},nombre.ilike.${pattern}`)
          .order("codigo", { ascending: true })
          .limit(6),
      ]);

    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const items: SearchHit[] = [];

    for (const a of animals ?? []) {
      const estado = a.estados_animales as
        | { codigo?: string; nombre?: string }
        | { codigo?: string; nombre?: string }[]
        | null;
      const est = Array.isArray(estado) ? estado[0] : estado;
      const corral = a.corrales as
        | { codigo?: string }
        | { codigo?: string }[]
        | null;
      const cor = Array.isArray(corral) ? corral[0] : corral;
      items.push({
        type: "animal",
        id: String(a.id),
        title: String(a.arete),
        subtitle: [
          est?.nombre ?? est?.codigo ?? "—",
          cor?.codigo ? `Corral ${cor.codigo}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/gestion/animales/${a.id}`,
      });
    }

    for (const m of modules ?? []) {
      items.push({
        type: "modulo",
        id: String(m.id),
        title: String(m.codigo),
        subtitle: [m.nombre, m.tipo].filter(Boolean).join(" · "),
        href: `/modules/${encodeURIComponent(String(m.codigo))}`,
      });
    }

    return jsonOk({ items });
  } catch (e) {
    return jsonServerError("search", e);
  }
}
