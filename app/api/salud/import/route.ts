import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { extractPdfText, extractPdfTextAsync } from "@/lib/api/pdf/extract-text";
import { parseSaludPdfText } from "@/lib/api/pdf/parse-salud";
import { registrarHistorial } from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Archivo PDF requerido (campo file).", 400);
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return jsonError("Solo se aceptan archivos PDF.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = extractPdfText(buffer);
    if (text.replace(/\s/g, "").length < 40) {
      try {
        text = await extractPdfTextAsync(buffer);
      } catch {
        // keep lightweight extract
      }
    }

    const parsed = parseSaludPdfText(text);

    const { data, error } = await admin
      .from("salud_importaciones")
      .insert({
        granja_id: granjaId,
        nombre_archivo: file.name.slice(0, 200),
        texto_extraido: text.slice(0, 20000),
        datos_parseados: parsed,
        estado: "pendiente",
        created_by: usuario?.id ?? null,
      })
      .select("id, datos_parseados, nombre_archivo, estado")
      .single();

    if (error) {
      if (error.code === "42P01") {
        return jsonError(
          "Tabla salud_importaciones no existe. Aplique la migración 20260802200000_salud_schema.",
          503
        );
      }
      return jsonError(error.message, 400);
    }

    await registrarHistorial(admin, {
      granjaId,
      modulo: "salud",
      registroId: data.id,
      referencia: file.name,
      accion: "crear",
      resumen: `PDF sanitario cargado para revisión: ${file.name}`,
      datosNuevos: { parsed },
      usuarioId: usuario?.id,
    });

    return jsonOk(
      {
        id: data.id as string,
        fileName: data.nombre_archivo,
        parsed: data.datos_parseados,
        status: data.estado,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
