import { isUuid, getSystemUserId } from "@/lib/api/granja";
import { requireApiContext } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/http";
import { mapAnimalToApi } from "@/lib/api/mappers";
import {
  ANIMAL_SELECT,
  findRazaId,
  normalizeAnimalRow,
} from "@/lib/api/animales-query";
import {
  countActiveAnimalsInCorral,
  getCorralCapacity,
  getCorralIdByCodigo,
  getEstadoIdByCodigo,
  adjustCorralOcupacion,
} from "@/lib/api/corrales-helpers";
import { registrarVentaAnimal } from "@/lib/api/venta-animal";
import {
  buildCambiosResumen,
  registrarHistorialAnimal,
  snapshotFromAnimalRow,
  snapshotFromApiBody,
} from "@/lib/api/historial-animal";
import { fetchCompraForAnimal } from "@/lib/api/compra-animal";
import { fetchActasForAnimal } from "@/lib/api/actas-animal";
import { normalizeWeightKg } from "@/lib/api/weight-utils";
import { upsertPesajeAnimal } from "@/lib/api/pesaje-utils";

export const dynamic = "force-dynamic";

function computeMetrics(
  fechaIngreso: string,
  pesoInicial: number,
  pesoActual: number
) {
  const start = new Date(fechaIngreso + "T12:00:00Z").getTime();
  const days = Math.max(1, Math.round((Date.now() - start) / 86400000));
  const gainKg = Math.round((pesoActual - pesoInicial) * 10) / 10;
  const adg = Math.round((gainKg / days) * 1000) / 1000;
  return { gainKg, daysInFeedlot: days, adg };
}

function permissionsForStatus(statusCodigo: string, hasVenta: boolean) {
  const isFinal = statusCodigo === "vendido" || statusCodigo === "muerto";
  return {
    canEdit: !isFinal,
    canDelete: !isFinal && !hasVenta,
    canChangeArete: !hasVenta && statusCodigo !== "vendido",
  };
}

type PatchBody = Partial<{
  tagId: string;
  breed: string;
  entryDate: string;
  initialWeight: number;
  currentWeight: number;
  moduleId: string;
  status: string;
  sex: string;
  age: number;
  observaciones: string;
  saleDate: string;
  salePricePerKg: number;
  saleBuyer: string;
}>;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);

    const { data: row, error } = await admin
      .from("animales")
      .select(ANIMAL_SELECT)
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return jsonError("Animal no encontrado.", 404);

    const normalized = normalizeAnimalRow(row as Record<string, unknown>);
    const raw = row as Record<string, unknown>;

    const [{ data: pesajes }, { data: ventaDetalle }, actas] = await Promise.all([
      admin
        .from("pesajes")
        .select("id, fecha_pesaje, peso_kg, tipo_pesaje")
        .eq("animal_id", id)
        .is("deleted_at", null)
        .order("fecha_pesaje", { ascending: false }),
      admin
        .from("detalle_ventas")
        .select(
          "id, peso_salida_kg, precio_kg, subtotal, ventas ( fecha_venta, clientes ( razon_social ) )"
        )
        .eq("animal_id", id)
        .maybeSingle(),
      fetchActasForAnimal(admin, id).catch(() => []),
    ]);

    const statusCodigo = normalized.estados_animales?.codigo ?? "activo";
    const hasVenta = !!ventaDetalle;

    const ventaRaw = ventaDetalle as Record<string, unknown> | null;
    const ventaJoin = ventaRaw?.ventas as
      | { fecha_venta: string; clientes: { razon_social: string } | null }
      | { fecha_venta: string; clientes: { razon_social: string } | null }[]
      | null;
    const ventaInfo = Array.isArray(ventaJoin) ? ventaJoin[0] : ventaJoin;

    const sale = ventaDetalle
      ? {
          saleDate: ventaInfo?.fecha_venta ?? "",
          buyer: ventaInfo?.clientes?.razon_social ?? "",
          pricePerKg: Number(ventaDetalle.precio_kg),
          totalRevenue: Number(ventaDetalle.subtotal),
          pesoSalidaKg: Number(ventaDetalle.peso_salida_kg),
        }
      : undefined;

    const purchase = await fetchCompraForAnimal(admin, normalized.compra_detalle_id);

    const margin =
      purchase && sale
        ? {
            perKg: Math.round((sale.pricePerKg - purchase.pricePerKg) * 100) / 100,
            total: Math.round((sale.totalRevenue - purchase.totalCost) * 100) / 100,
            pct:
              purchase.totalCost > 0
                ? Math.round(
                    ((sale.totalRevenue - purchase.totalCost) / purchase.totalCost) * 10000
                  ) / 100
                : null,
          }
        : undefined;

    return jsonOk({
      ...mapAnimalToApi(normalized, purchase),
      observaciones: (raw.observaciones as string | null) ?? undefined,
      purchase: purchase ?? undefined,
      margin,
      metrics: computeMetrics(
        normalized.fecha_ingreso,
        Number(normalized.peso_inicial_kg),
        Number(normalized.peso_actual_kg)
      ),
      pesajes: (pesajes ?? []).map((p) => ({
        id: p.id,
        fecha: p.fecha_pesaje,
        pesoKg: Number(p.peso_kg),
        tipo: p.tipo_pesaje,
      })),
      actas,
      sale,
      permissions: permissionsForStatus(statusCodigo, hasVenta),
    });
  } catch (e) {
    return jsonServerError("animals/[id]", e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return jsonError("id de animal inválido.");

    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId } = auth.ctx;
    const url = new URL(req.url);
    const body = (await req.json()) as PatchBody;

    const { data: current, error: e0 } = await admin
      .from("animales")
      .select(`${ANIMAL_SELECT}, estado_id, corral_id, observaciones`)
      .eq("granja_id", granjaId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!current) return jsonError("Animal no encontrado.", 404);

    const normalized = normalizeAnimalRow(current as Record<string, unknown>);
    const cur = {
      ...normalized,
      estado_id: (current as { estado_id: string }).estado_id,
      corral_id: (current as { corral_id: string | null }).corral_id,
    };

    const statusActual = cur.estados_animales?.codigo ?? "activo";
    if (statusActual === "vendido" || statusActual === "muerto") {
      return jsonError(
        `No se puede modificar un animal en estado '${statusActual}'.`,
        409
      );
    }

    if (body.status === "vendido") {
      if (!body.saleDate) {
        return jsonError("La fecha de venta es obligatoria.", 400);
      }
      if (body.salePricePerKg == null || body.salePricePerKg < 0) {
        return jsonError("El precio por kg es obligatorio.", 400);
      }
      if (!body.saleBuyer?.trim()) {
        return jsonError("El comprador es obligatorio.", 400);
      }

      const finalWeight = normalizeWeightKg(body.currentWeight ?? Number(cur.peso_actual_kg));
      const saleResult = await registrarVentaAnimal(admin, granjaId, {
        animalId: id,
        arete: cur.arete,
        finalWeight,
        pricePerKg: body.salePricePerKg,
        saleDate: body.saleDate,
        buyer: body.saleBuyer.trim(),
        wasActivo: statusActual === "activo",
        corralId: cur.corral_id,
      });
      if (!saleResult.ok) {
        return jsonError(saleResult.message, saleResult.status);
      }

      if (body.observaciones !== undefined) {
        await admin
          .from("animales")
          .update({
            observaciones: body.observaciones?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }

      const { data: sold, error: eSold } = await admin
        .from("animales")
        .select(ANIMAL_SELECT)
        .eq("granja_id", granjaId)
        .eq("id", id)
        .single();
      if (eSold) return jsonError(eSold.message, 500);

      return jsonOk(mapAnimalToApi(normalizeAnimalRow(sold as Record<string, unknown>)));
    }

    const { data: venta } = await admin
      .from("detalle_ventas")
      .select("id")
      .eq("animal_id", id)
      .maybeSingle();

    if (venta && body.tagId != null && body.tagId.trim() !== cur.arete) {
      return jsonError("No se puede cambiar el arete de un animal vendido.", 409);
    }

    let corralId: string | null = cur.corral_id;
    if (body.moduleId != null) {
      const found = await getCorralIdByCodigo(admin, granjaId, body.moduleId.trim());
      if (!found) return jsonError(`Corral '${body.moduleId}' no existe.`);
      corralId = found;
    }

    let estadoId = cur.estado_id;
    if (body.status != null) {
      const found = await getEstadoIdByCodigo(admin, body.status);
      if (!found) return jsonError(`Estado '${body.status}' no existe.`);
      estadoId = found;
    }

    const nextStatus = body.status ?? statusActual;
    if (nextStatus === "activo" && corralId) {
      const cap = await getCorralCapacity(admin, granjaId, corralId);
      const others = await countActiveAnimalsInCorral(admin, granjaId, corralId, id);
      if (others + 1 > cap) {
        return jsonError(`Capacidad del corral agotada (${others + 1}/${cap}).`);
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.tagId != null) patch.arete = body.tagId.trim();
    if (body.breed != null) {
      const razaId = await findRazaId(admin, granjaId, body.breed);
      if (!razaId) {
        return jsonError(
          `Raza '${body.breed}' no encontrada. Configúrela en Administración.`
        );
      }
      patch.raza_id = razaId;
    }
    if (body.entryDate != null) patch.fecha_ingreso = body.entryDate;
    if (body.initialWeight != null) patch.peso_inicial_kg = normalizeWeightKg(body.initialWeight);
    if (body.currentWeight != null) patch.peso_actual_kg = normalizeWeightKg(body.currentWeight);
    if (body.moduleId != null) patch.corral_id = corralId;
    if (body.status != null) patch.estado_id = estadoId;
    if (body.sex != null) patch.sexo = body.sex === "H" ? "H" : "M";
    if (body.observaciones !== undefined) {
      patch.observaciones = body.observaciones?.trim() || null;
    }
    if (body.age != null && body.age > 0 && body.entryDate) {
      const d = new Date((body.entryDate ?? cur.fecha_ingreso) + "T12:00:00Z");
      d.setMonth(d.getMonth() - body.age);
      patch.fecha_nacimiento = d.toISOString().slice(0, 10);
    }

    const oldCorral = cur.corral_id;
    const oldActivo = statusActual === "activo";
    const newActivo = nextStatus === "activo";
    const pesoAnterior = Number(cur.peso_actual_kg);
    const pesoNuevo =
      body.currentWeight != null ? normalizeWeightKg(body.currentWeight) : pesoAnterior;
    const snapAnterior = snapshotFromAnimalRow(cur);

    const { data, error } = await admin
      .from("animales")
      .update(patch)
      .eq("granja_id", granjaId)
      .eq("id", id)
      .select(ANIMAL_SELECT)
      .single();
    if (error) {
      if (error.code === "23505") {
        return jsonError("Ya existe un animal con ese arete en la granja.");
      }
      return jsonError(error.message, 400);
    }

    if (oldCorral !== corralId || oldActivo !== newActivo) {
      if (oldCorral && oldActivo) await adjustCorralOcupacion(admin, oldCorral, -1);
      if (corralId && newActivo) await adjustCorralOcupacion(admin, corralId, 1);
    }

    if (body.currentWeight != null && pesoNuevo !== pesoAnterior) {
      const pesajeResult = await upsertPesajeAnimal(admin, {
        animalId: id,
        fechaPesaje: new Date().toISOString().slice(0, 10),
        pesoKg: pesoNuevo,
        tipoPesaje: "rutina",
        registradoPorId: getSystemUserId(),
      });
      if (!pesajeResult.ok) return jsonError(pesajeResult.message, 400);
    }

    const updated = normalizeAnimalRow(data as Record<string, unknown>);
    const snapNuevo = snapshotFromAnimalRow(updated);
    const cambiosParcial = snapshotFromApiBody(body);
    const resumen = buildCambiosResumen(snapAnterior, {
      ...cambiosParcial,
      pesoActualKg: body.currentWeight ?? snapAnterior.pesoActualKg,
    });

    await registrarHistorialAnimal(admin, {
      granjaId,
      animalId: id,
      arete: updated.arete,
      accion: "modificar",
      resumen: `Arete ${updated.arete}: ${resumen}`,
      datosAnteriores: snapAnterior,
      datosNuevos: snapNuevo,
    });

    return jsonOk(mapAnimalToApi(updated));
  } catch (e) {
    return jsonServerError("animals/[id]", e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("id de animal inválido.");
  return jsonError(
    "La baja requiere solicitud con justificación. Use POST /api/animals/{id}/solicitud-baja y la autorización del administrador en Mensajería.",
    405
  );
}
