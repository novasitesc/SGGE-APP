/**
 * Ajuste interno de inventario (soft-delete + reactivar vendido).
 *
 * Soft-delete (deleted_at) — NO marca como muerto/pérdida.
 * Reactiva vendido 044 → activo, arete 5875, corral Zapote Abajo.
 *
 *   npx tsx --env-file=.env.local scripts/ajuste-inventario-zapote-ceiba.ts
 *   npx tsx --env-file=.env.local scripts/ajuste-inventario-zapote-ceiba.ts --confirm
 */
import { createClient } from "@supabase/supabase-js";
import WS from "ws";

(globalThis as { WebSocket: unknown }).WebSocket = WS;

const CONFIRM = process.argv.includes("--confirm");

const ELIMINAR: Array<{ corralHint: string; aretes: string[] }> = [
  {
    corralHint: "zapote 1",
    aretes: ["107", "124", "157", "203", "205", "228", "231", "238", "269", "442"],
  },
  {
    corralHint: "zapote 2",
    aretes: ["0168", "0175", "0446", "044", "0442", "0449", "0525", "0527"],
  },
  {
    corralHint: "ceiba arriba",
    aretes: ["294", "26TT"],
  },
];

const REACTIVAR = {
  areteActual: "044",
  corralActualHint: "ceiba abajo",
  nuevoArete: "5875",
  corralDestinoHint: "zapote abajo",
};

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function areteVariants(a: string): string[] {
  const raw = a.trim();
  const noZeros = raw.replace(/^0+/, "") || "0";
  const variants = [
    raw,
    noZeros,
    noZeros.padStart(3, "0"),
    noZeros.padStart(4, "0"),
    noZeros.padStart(5, "0"),
    raw.toUpperCase(),
    raw.toLowerCase(),
  ];
  return [...new Set(variants)];
}

/** Mapea hints humanos → patrones sobre corrales.nombre / codigo */
function matchesCorral(nombre: string, hint: string, codigo?: string | null) {
  const n = norm(nombre);
  const h = norm(hint);
  const c = norm(codigo ?? "");

  if (n === h || n.includes(h) || h.includes(n)) return true;

  const rules: Array<{ hint: RegExp; match: RegExp }> = [
    { hint: /zapote\s*1|zapote\s*uno/, match: /zapote\s*uno|^1zapote|^(m)?1$/ },
    { hint: /zapote\s*2|zapote\s*dos/, match: /zapote\s*dos|^2zapote|^(m)?2$/ },
    { hint: /zapote\s*abajo/, match: /zapote\s*abajo|^5zapote|^(m)?5$/ },
    { hint: /ceiba\s*arriba/, match: /ceiba\s*arriba|^3ceiba|^(m)?3$/ },
    { hint: /ceiba\s*abajo/, match: /ceiba\s*abajo|^4ceiba|^(m)?4$/ },
  ];

  for (const r of rules) {
    if (r.hint.test(h) && (r.match.test(n) || r.match.test(c))) return true;
  }
  return false;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta .env.local (URL / SERVICE_ROLE_KEY)");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: corrales, error: eCorrales } = await admin
    .from("corrales")
    .select("id, codigo, nombre, granja_id, ocupacion_actual, deleted_at")
    .is("deleted_at", null)
    .order("nombre");
  if (eCorrales) throw new Error(eCorrales.message);

  console.log("\n=== Corrales activos ===");
  for (const c of corrales ?? []) {
    console.log(`  ${c.codigo ?? "—"} | ${c.nombre} | id=${c.id} | occ=${c.ocupacion_actual}`);
  }

  const { data: estados, error: eEst } = await admin
    .from("estados_animales")
    .select("id, codigo, nombre");
  if (eEst) throw new Error(eEst.message);
  const estadoByCodigo = new Map((estados ?? []).map((e) => [e.codigo, e]));
  const estadoActivo = estadoByCodigo.get("activo");
  if (!estadoActivo) throw new Error("Estado 'activo' no encontrado");

  type AnimalRow = {
    id: string;
    arete: string;
    granja_id: string;
    corral_id: string | null;
    estado_id: string | null;
    deleted_at: string | null;
    corrales: { id: string; codigo: string | null; nombre: string } | null;
    estados_animales: { id: string; codigo: string; nombre: string } | null;
  };

  async function findAnimals(
    areteList: string[],
    corralHint: string | null
  ): Promise<AnimalRow[]> {
    const variants = [...new Set(areteList.flatMap(areteVariants))];
    const { data, error } = await admin
      .from("animales")
      .select(
        `
        id, arete, granja_id, corral_id, estado_id, deleted_at,
        corrales ( id, codigo, nombre ),
        estados_animales ( id, codigo, nombre )
      `
      )
      .in("arete", variants);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as AnimalRow[];
    if (!corralHint) return rows;
    return rows.filter((r) => {
      const nombre = r.corrales?.nombre ?? "";
      const codigo = r.corrales?.codigo ?? null;
      return matchesCorral(nombre, corralHint, codigo);
    });
  }

  // ── Soft deletes ──────────────────────────────────────────────
  console.log(`\n=== Soft-delete (modo: ${CONFIRM ? "CONFIRM" : "DRY-RUN"}) ===`);
  const softDeleteIds: Array<{
    id: string;
    arete: string;
    corralId: string | null;
    estado: string;
    granjaId: string;
    corralNombre: string;
  }> = [];

  for (const grupo of ELIMINAR) {
    console.log(`\n-- ${grupo.corralHint} --`);
    for (const arete of grupo.aretes) {
      const found = await findAnimals([arete], grupo.corralHint);
      const activos = found.filter((f) => !f.deleted_at);
      const yaBorrados = found.filter((f) => f.deleted_at);

      if (activos.length === 0) {
        if (yaBorrados.length > 0) {
          console.log(
            `  ${arete}: YA soft-deleted (${yaBorrados.map((x) => `${x.arete}@${x.corrales?.nombre}`).join(", ")})`
          );
        } else {
          // buscar sin filtro de corral para diagnóstico
          const anywhere = await findAnimals([arete], null);
          if (anywhere.length === 0) {
            console.log(`  ${arete}: NO ENCONTRADO`);
          } else {
            console.log(
              `  ${arete}: NO en "${grupo.corralHint}" — hallados: ${anywhere
                .map(
                  (x) =>
                    `${x.arete}@${x.corrales?.nombre ?? "?"} estado=${x.estados_animales?.codigo ?? "?"} deleted=${!!x.deleted_at}`
                )
                .join(" | ")}`
            );
          }
        }
        continue;
      }

      if (activos.length > 1) {
        console.log(
          `  ${arete}: AMBIGUO (${activos.length}) → ${activos
            .map((x) => `${x.arete}@${x.corrales?.nombre} ${x.estados_animales?.codigo}`)
            .join(" | ")}`
        );
      }

      for (const a of activos) {
        const estado = a.estados_animales?.codigo ?? "?";
        console.log(
          `  ${arete} → soft-delete ${a.arete} id=${a.id.slice(0, 8)}… corral=${a.corrales?.nombre} estado=${estado}`
        );
        softDeleteIds.push({
          id: a.id,
          arete: a.arete,
          corralId: a.corral_id,
          estado,
          granjaId: a.granja_id,
          corralNombre: a.corrales?.nombre ?? "?",
        });
      }
    }
  }

  // ── Reactivar vendido 044 ─────────────────────────────────────
  console.log(`\n=== Reactivar vendido ${REACTIVAR.areteActual} ===`);
  const candidatos = await findAnimals(
    [REACTIVAR.areteActual],
    REACTIVAR.corralActualHint
  );
  let vendido =
    candidatos.find(
      (c) => !c.deleted_at && c.estados_animales?.codigo === "vendido"
    ) ??
    candidatos.find((c) => !c.deleted_at) ??
    null;

  if (!vendido) {
    const anywhere = await findAnimals([REACTIVAR.areteActual], null);
    console.log(
      `  No hallado en "${REACTIVAR.corralActualHint}". Alternativas: ${
        anywhere.length
          ? anywhere
              .map(
                (x) =>
                  `${x.arete}@${x.corrales?.nombre ?? "?"} estado=${x.estados_animales?.codigo} deleted=${!!x.deleted_at}`
              )
              .join(" | ")
          : "ninguna"
      }`
    );
  } else {
    console.log(
      `  Hallado: ${vendido.arete} id=${vendido.id} corral=${vendido.corrales?.nombre} estado=${vendido.estados_animales?.codigo}`
    );

    const { data: detalle } = await admin
      .from("detalle_ventas")
      .select("id, venta_id, peso_salida_kg, precio_kg, subtotal")
      .eq("animal_id", vendido.id)
      .maybeSingle();
    console.log(`  detalle_ventas: ${detalle ? detalle.id : "ninguno"}`);

    const destinos = (corrales ?? []).filter((c) =>
      matchesCorral(c.nombre, REACTIVAR.corralDestinoHint, c.codigo)
    );
    console.log(
      `  Destino "${REACTIVAR.corralDestinoHint}": ${
        destinos.map((d) => `${d.nombre} (${d.codigo})`).join(", ") || "NO ENCONTRADO"
      }`
    );

    // ¿arete 5875 ya ocupado?
    const { data: conflict } = await admin
      .from("animales")
      .select("id, arete, deleted_at, corrales(nombre), estados_animales(codigo)")
      .eq("arete", REACTIVAR.nuevoArete)
      .neq("id", vendido.id);
    if (conflict && conflict.length > 0) {
      console.log(
        `  CONFLICTO arete ${REACTIVAR.nuevoArete}: ${conflict
          .map(
            (c) =>
              `${c.arete} deleted=${!!c.deleted_at} @${(c.corrales as { nombre?: string } | null)?.nombre ?? "?"}`
          )
          .join(" | ")}`
      );
    }

    if (CONFIRM && destinos.length === 1) {
      const destino = destinos[0];
      const granjaId = vendido.granja_id;

      // 1) Revertir venta si existe
      if (detalle) {
        const { error: eDel } = await admin
          .from("detalle_ventas")
          .delete()
          .eq("id", detalle.id);
        if (eDel) throw new Error(`borrar detalle_ventas: ${eDel.message}`);

        const { count } = await admin
          .from("detalle_ventas")
          .select("id", { count: "exact", head: true })
          .eq("venta_id", detalle.venta_id);
        if ((count ?? 0) === 0) {
          await admin.from("ventas").delete().eq("id", detalle.venta_id);
        }
        console.log(`  ✓ Venta revertida (detalle ${detalle.id})`);
      }

      // 2) Actualizar animal: activo + nuevo arete + corral destino
      const prevCorral = vendido.corral_id;
      const { error: eUpd } = await admin
        .from("animales")
        .update({
          estado_id: estadoActivo.id,
          arete: REACTIVAR.nuevoArete,
          corral_id: destino.id,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vendido.id);
      if (eUpd) throw new Error(`update animal: ${eUpd.message}`);

      // 3) Ocupación: +1 destino; si venía de otro corral y no estaba activo, no restar origen de activo
      // Al reactivar vendido, la ocupación del corral origen no se había decrementado al vender
      // (revisar adjustCorralOcupacion en venta). Sumamos destino.
      const { data: destRow } = await admin
        .from("corrales")
        .select("ocupacion_actual")
        .eq("id", destino.id)
        .single();
      if (destRow) {
        await admin
          .from("corrales")
          .update({
            ocupacion_actual: Math.max(0, Number(destRow.ocupacion_actual ?? 0) + 1),
          })
          .eq("id", destino.id);
      }

      // Si cambió de corral y el origen tenía ocupación contando vendidos? Normalmente
      // vendido ya no cuenta. Solo ajustamos destino.
      void prevCorral;

      await admin.from("historial_sistema").insert({
        granja_id: granjaId,
        modulo: "animales",
        registro_id: vendido.id,
        referencia: REACTIVAR.nuevoArete,
        accion: "modificar",
        resumen: `Ajuste interno: reactivado vendido ${REACTIVAR.areteActual} → arete ${REACTIVAR.nuevoArete} en ${destino.nombre} (sin registrar pérdida).`,
        datos_nuevos: {
          areteAnterior: REACTIVAR.areteActual,
          areteNuevo: REACTIVAR.nuevoArete,
          corralAnterior: vendido.corrales?.nombre,
          corralNuevo: destino.nombre,
          ajusteInterno: true,
        },
      });

      console.log(
        `  ✓ Reactivado: arete ${REACTIVAR.nuevoArete} en ${destino.nombre} (activo)`
      );
    } else if (CONFIRM && destinos.length !== 1) {
      console.log(`  ✗ No se aplica reactivación: destinos=${destinos.length}`);
    }
  }

  // Aplicar soft-deletes
  if (CONFIRM) {
    console.log("\n=== Aplicando soft-deletes ===");
    for (const item of softDeleteIds) {
      // Soft-delete interno: también vendidos/muertos (no cuentan como pérdida nueva).
      // Se deja detalle_ventas histórico si existe.

      const { error } = await admin
        .from("animales")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) {
        console.log(`  ✗ ${item.arete}: ${error.message}`);
        continue;
      }

      if (item.corralId && item.estado === "activo") {
        const { data: corral } = await admin
          .from("corrales")
          .select("ocupacion_actual")
          .eq("id", item.corralId)
          .single();
        if (corral) {
          await admin
            .from("corrales")
            .update({
              ocupacion_actual: Math.max(
                0,
                Number(corral.ocupacion_actual ?? 0) - 1
              ),
            })
            .eq("id", item.corralId);
        }
      }

      await admin.from("historial_sistema").insert({
        granja_id: item.granjaId,
        modulo: "animales",
        registro_id: item.id,
        referencia: item.arete,
        accion: "eliminar",
        resumen: `Ajuste interno inventario: soft-delete arete ${item.arete} (${item.corralNombre}) — no cuenta como pérdida.`,
        datos_nuevos: { ajusteInterno: true, motivo: "limpieza inventario" },
      });

      console.log(`  ✓ Soft-deleted ${item.arete} @ ${item.corralNombre}`);
    }
  } else {
    console.log(
      `\nDRY-RUN: ${softDeleteIds.length} animales a soft-delete. Ejecuta con --confirm para aplicar.`
    );
  }

  console.log("\nListo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
