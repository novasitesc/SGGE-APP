import { requireApiContext } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/http";
import { listAlertas, listTratamientos } from "@/modules/salud";
import { registrarHistorial } from "@/lib/api/historial-sistema";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Genera un informe HTML imprimible (el navegador puede "Guardar como PDF").
 * Query: ?format=html|csv  &from=&to=&animalId=
 */
export async function GET(req: Request) {
  try {
    const auth = await requireApiContext(req);
    if (!auth.ok) return auth.response;
    const { admin, granjaId, usuario } = auth.ctx;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "html";
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const animalId = url.searchParams.get("animalId") ?? undefined;

    const treatments = await listTratamientos(admin, granjaId, {
      from,
      to,
      animalId,
    });
    const alerts = await listAlertas(admin, granjaId, { includeResolved: true });

    await registrarHistorial(admin, {
      granjaId,
      modulo: "salud",
      referencia: `export-${format}`,
      accion: "modificar",
      resumen: `Exportación sanitaria (${format}): ${treatments.length} tratamientos.`,
      usuarioId: usuario?.id,
    });

    if (format === "csv") {
      const header =
        "id,nombre,tipo,fecha,animales,costo_total,aplicado_por,proxima,notas";
      const lines = treatments.map((t) =>
        [
          t.id,
          `"${t.name.replace(/"/g, '""')}"`,
          t.type,
          t.date,
          t.animalCount,
          t.totalCost,
          `"${(t.appliedBy ?? "").replace(/"/g, '""')}"`,
          t.nextDue ?? "",
          `"${(t.notes ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      );
      const csv = [header, ...lines].join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="salud-${granjaId.slice(0, 8)}.csv"`,
        },
      });
    }

    const total = treatments.reduce((s, t) => s + t.totalCost, 0);
    const rows = treatments
      .map(
        (t) => `<tr>
        <td>${escapeHtml(t.date)}</td>
        <td>${escapeHtml(t.name)}</td>
        <td>${escapeHtml(String(t.type))}</td>
        <td>${t.animalCount}</td>
        <td>${t.totalCost.toFixed(2)}</td>
        <td>${escapeHtml(t.appliedBy || "—")}</td>
        <td>${escapeHtml(t.nextDue || "—")}</td>
      </tr>`
      )
      .join("\n");

    const alertRows = alerts
      .slice(0, 40)
      .map(
        (a) => `<tr>
        <td>${escapeHtml(a.dueDate)}</td>
        <td>${escapeHtml(a.message)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${escapeHtml(a.priority)}</td>
        <td>${escapeHtml(a.status)}</td>
      </tr>`
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe sanitario SGGE</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 40px; }
    h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .meta { color: #555; font-size: 13px; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
    .kpi { display: flex; gap: 24px; margin: 16px 0 28px; }
    .kpi div { min-width: 120px; }
    .kpi strong { display: block; font-size: 22px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Informe sanitario</h1>
  <p class="meta">SGGE · Generado ${new Date().toLocaleString("es-CR")}
    ${from || to ? ` · Período ${from ?? "…"} → ${to ?? "…"}` : ""}</p>
  <div class="kpi">
    <div><strong>${treatments.length}</strong>Tratamientos</div>
    <div><strong>${alerts.filter((a) => a.status === "activa").length}</strong>Alertas activas</div>
    <div><strong>₡${total.toFixed(2)}</strong>Costo total</div>
  </div>
  <h2>Tratamientos</h2>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Nombre</th><th>Tipo</th><th>Animales</th>
      <th>Costo</th><th>Aplicado por</th><th>Próxima</th>
    </tr></thead>
    <tbody>${rows || "<tr><td colspan='7'>Sin tratamientos</td></tr>"}</tbody>
  </table>
  <h2>Alertas</h2>
  <table>
    <thead><tr>
      <th>Vence</th><th>Mensaje</th><th>Tipo</th><th>Prioridad</th><th>Estado</th>
    </tr></thead>
    <tbody>${alertRows || "<tr><td colspan='5'>Sin alertas</td></tr>"}</tbody>
  </table>
  <script>window.onload = () => { /* listo para imprimir / guardar PDF */ }</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="informe-salud.html"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return jsonError(msg, 500);
  }
}
