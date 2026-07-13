import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  findRazaByNombre,
  nextCodigoRaza,
  type RazaRow,
} from "@/lib/api/razas-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(admin, url.searchParams.get("farmId"));
    const full = url.searchParams.get("full") === "1";

    const { data, error } = await admin
      .from("razas")
      .select("id, codigo, nombre, activa")
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as RazaRow[];
    if (full) return jsonOk(rows);

    // Dropdowns de animales/ventas: solo razas activas
    return jsonOk(rows.filter((r) => r.activa).map((r) => r.nombre));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

type PostBody = {
  nombre?: string;
  codigo?: string;
  activa?: boolean;
};

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(admin, url.searchParams.get("farmId"));
    const body = (await req.json()) as PostBody;

    const nombre = body.nombre?.trim();
    if (!nombre) return jsonError("nombre es obligatorio.");
    if (nombre.length > 100) return jsonError("nombre no puede superar 100 caracteres.");

    const existing = await findRazaByNombre(admin, granjaId, nombre);
    if (existing) {
      return jsonError(`Ya existe una raza con el nombre '${existing.nombre}'.`);
    }

    const codigo = body.codigo?.trim()
      ? body.codigo.trim().toUpperCase().slice(0, 20)
      : await nextCodigoRaza(admin, granjaId, nombre);

    const { data, error } = await admin
      .from("razas")
      .insert({
        granja_id: granjaId,
        codigo,
        nombre,
        activa: body.activa ?? true,
      })
      .select("id, codigo, nombre, activa")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError(`Ya existe una raza con el código '${codigo}'.`);
      }
      return jsonError(error.message, 400);
    }

    return jsonOk(data as RazaRow, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
