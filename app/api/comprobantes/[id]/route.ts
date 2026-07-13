import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGranjaId } from "@/lib/api/granja";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "comprobantes";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const admin = createSupabaseAdmin();
    const url = new URL(req.url);
    const granjaId = await resolveGranjaId(
      admin,
      url.searchParams.get("farmId") ?? url.searchParams.get("granjaId")
    );

    const { data: row, error: e0 } = await admin
      .from("comprobantes")
      .select("id, archivo_path, estado")
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!row) return jsonError("Comprobante no encontrado.", 404);
    if (row.estado === "confirmado") {
      return jsonError(
        "No se puede eliminar un comprobante confirmado (tiene compra/gasto asociado).",
        409
      );
    }

    const { error: eDel } = await admin
      .from("comprobantes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (eDel) return jsonError(eDel.message, 400);

    await admin.storage.from(BUCKET).remove([row.archivo_path as string]);

    return jsonOk({ id, deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
