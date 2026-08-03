
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  COMPROBANTE_SELECT,
  mapComprobanteToApi,
  uploadComprobante,
  type ComprobanteRow,
} from "@/lib/api/comprobantes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const estado = url.searchParams.get("estado");

    let query = admin
      .from("comprobantes")
      .select(COMPROBANTE_SELECT)
      .eq("granja_id", granjaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (estado) query = query.eq("estado", estado);

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01") {
        return jsonError(
          "Tabla 'comprobantes' no existe. Ejecute docs/database/comprobantes-modulo.sql en Supabase.",
          503
        );
      }
      throw new Error(error.message);
    }

    const mapped = await Promise.all(
      (data ?? []).map((r) => mapComprobanteToApi(admin, r as ComprobanteRow))
    );
    return jsonOk(mapped);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const single = form.get("file");
    if (single instanceof File) files.push(single);

    if (files.length === 0) {
      return jsonError("No se recibió ningún archivo (campo 'files').");
    }

    const results: Array<{
      name: string;
      ok: boolean;
      duplicated?: boolean;
      error?: string;
      comprobante?: Awaited<ReturnType<typeof uploadComprobante>>;
    }> = [];

    const uploaded = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        results.push({ name: file.name, ok: false, error: "Archivo supera 20 MB." });
        continue;
      }
      const mime = file.type || "application/pdf";
      if (!ALLOWED.has(mime)) {
        results.push({ name: file.name, ok: false, error: `Tipo no permitido: ${mime}` });
        continue;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await uploadComprobante(
        admin,
        granjaId,
        { buffer, name: file.name, mime }
      );
      if (res.ok) {
        uploaded.push({ ...res.comprobante, duplicated: res.duplicated });
        results.push({ name: file.name, ok: true, duplicated: res.duplicated });
      } else {
        results.push({ name: file.name, ok: false, error: res.message });
      }
    }

    return jsonOk(
      { items: uploaded, results },
      { status: uploaded.length > 0 ? 201 : 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
