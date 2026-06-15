import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** Tratamientos por lote: pendiente adaptación completa al módulo salud SRRG. */
export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const granjaId = await resolveGranjaId(
      admin,
      new URL(req.url).searchParams.get("farmId")
    );

    const { data: animales } = await admin
      .from("animales")
      .select("id")
      .eq("granja_id", granjaId)
      .is("deleted_at", null);
    const ids = (animales ?? []).map((a: { id: string }) => a.id);
    if (ids.length === 0) return jsonOk([]);

    const { data, error } = await admin
      .from("tratamientos")
      .select(
        "id, fecha_inicio, costo_total, estado, observaciones, medicamentos(nombre)"
      )
      .in("animal_id", ids)
      .is("deleted_at", null)
      .order("fecha_inicio", { ascending: false });
    if (error) throw new Error(error.message);

    const mapped = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: "tratamiento",
      name: (row.medicamentos as { nombre: string } | null)?.nombre ?? "Tratamiento",
      date: row.fecha_inicio as string,
      animalCount: 1,
      costPerAnimal: Number(row.costo_total),
      totalCost: Number(row.costo_total),
      appliedBy: "",
      notes: (row.observaciones as string) ?? "",
    }));

    return jsonOk(mapped);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function POST() {
  return jsonError(
    "Registro de tratamientos disponible en la Fase 4 (módulo salud).",
    501
  );
}
