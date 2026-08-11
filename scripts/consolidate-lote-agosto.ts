/**
 * Crea/usa el lote de agosto, mueve animales/alimentaciones/tratamientos
 * y soft-deletea el resto de lotes.
 *
 *   npx tsx --env-file=.env.local scripts/consolidate-lote-agosto.ts --apply
 */
const APPLY = process.argv.includes("--apply");

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta ${name} en .env.local`);
  return v;
}

async function rest<T = unknown>(
  path: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<T> {
  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: init.prefer ?? "return=representation",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  if (!text) return [] as T;
  return JSON.parse(text) as T;
}

async function countEq(table: string, filter: string): Promise<number> {
  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
    method: "HEAD",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const cr = res.headers.get("content-range");
  const m = cr?.match(/\/(\d+|\*)/);
  if (!m || m[1] === "*") return 0;
  return Number(m[1]);
}

type Lote = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  fecha_apertura: string | null;
  granja_id: string;
  deleted_at?: string | null;
};

async function main() {
  const lotes = await rest<Lote[]>(
    "lotes?deleted_at=is.null&select=id,codigo,nombre,estado,fecha_apertura,granja_id&order=fecha_apertura.asc"
  );

  console.log("\n=== Lotes activos ===");
  for (const l of lotes) {
    console.log(
      `  ${l.codigo} | ${l.nombre} | ${l.estado} | apertura=${l.fecha_apertura} | id=${l.id}`
    );
  }

  if (lotes.length === 0) {
    throw new Error("No hay lotes; no se puede inferir granja_id.");
  }
  const granja = lotes[0].granja_id;

  let agosto =
    lotes.find((l) => /agosto/i.test(`${l.codigo ?? ""} ${l.nombre ?? ""}`)) ??
    null;

  if (!APPLY) {
    console.log(
      `\nPlan:\n` +
        `  1) ${agosto ? "Usar" : "Crear"} lote Agosto 2026\n` +
        `  2) Reasignar animales / alimentaciones / tratamientos de la granja\n` +
        `  3) Soft-deletear los demás lotes (${lotes
          .filter((l) => l.id !== agosto?.id)
          .map((l) => l.codigo)
          .join(", ")})\n`
    );
    for (const table of ["animales", "alimentaciones", "tratamientos"]) {
      console.log(`\n=== ${table} por lote ===`);
      for (const l of lotes) {
        const n = await countEq(table, `lote_id=eq.${l.id}&select=id`);
        console.log(`  ${l.codigo}: ${n}`);
      }
    }
    console.log("\n(Dry-run) Usa --apply para ejecutar.\n");
    return;
  }

  if (!agosto) {
    const created = await rest<Lote[]>("lotes", {
      method: "POST",
      body: JSON.stringify({
        granja_id: granja,
        codigo: "L-2026-08",
        nombre: "Engorda Agosto 2026",
        estado: "abierto",
        fecha_apertura: "2026-08-01",
        fecha_cierre: null,
        capacidad_maxima: 200,
        objetivo_peso_kg: 450,
      }),
    });
    agosto = Array.isArray(created) ? created[0] : (created as Lote);
    console.log(`\n✓ Creado lote: ${agosto.codigo} / ${agosto.nombre} [${agosto.id}]`);
  } else {
    console.log(`\n→ Usando lote existente: ${agosto.codigo} [${agosto.id}]`);
  }

  const keepId = agosto.id;
  const now = new Date().toISOString();
  const others = (
    await rest<Lote[]>(
      `lotes?granja_id=eq.${granja}&deleted_at=is.null&select=id,codigo,nombre,estado,fecha_apertura,granja_id`
    )
  ).filter((l) => l.id !== keepId);

  // Animales: todos → agosto
  const anim = await rest<{ id: string }[]>(
    `animales?granja_id=eq.${granja}&deleted_at=is.null`,
    {
      method: "PATCH",
      body: JSON.stringify({ lote_id: keepId, updated_at: now }),
    }
  );
  console.log(`✓ Animales → agosto: ${anim.length}`);

  // Alimentaciones
  const alim = await rest<{ id: string }[]>(
    `alimentaciones?granja_id=eq.${granja}`,
    {
      method: "PATCH",
      body: JSON.stringify({ lote_id: keepId }),
    }
  );
  console.log(`✓ Alimentaciones → agosto: ${alim.length}`);

  // Tratamientos (pueden no tener granja_id en filtro si falla)
  try {
    const trat = await rest<{ id: string }[]>(
      `tratamientos?granja_id=eq.${granja}`,
      {
        method: "PATCH",
        body: JSON.stringify({ lote_id: keepId }),
      }
    );
    console.log(`✓ Tratamientos → agosto: ${trat.length}`);
  } catch (e) {
    console.log(`⚠ tratamientos: ${e instanceof Error ? e.message : e}`);
  }

  for (const o of others) {
    await rest(`lotes?id=eq.${o.id}&granja_id=eq.${granja}`, {
      method: "PATCH",
      body: JSON.stringify({
        deleted_at: now,
        estado: "cerrado",
        fecha_cierre: now.slice(0, 10),
      }),
      prefer: "return=minimal",
    });
    console.log(`✓ Borrado (soft): ${o.codigo} / ${o.nombre}`);
  }

  await rest(`lotes?id=eq.${keepId}`, {
    method: "PATCH",
    body: JSON.stringify({
      estado: "abierto",
      fecha_cierre: null,
      deleted_at: null,
    }),
    prefer: "return=minimal",
  });

  const left = await rest<Lote[]>(
    `lotes?granja_id=eq.${granja}&deleted_at=is.null&select=id,codigo,nombre,estado&order=codigo.asc`
  );
  console.log("\n=== Lotes activos ===");
  for (const l of left) {
    console.log(`  ${l.codigo} | ${l.nombre} | ${l.estado}`);
  }

  const inAgosto = await countEq(
    "animales",
    `granja_id=eq.${granja}&lote_id=eq.${keepId}&deleted_at=is.null&select=id`
  );
  const fuera = await countEq(
    "animales",
    `granja_id=eq.${granja}&lote_id=neq.${keepId}&deleted_at=is.null&select=id`
  );
  console.log(`\nAnimales en agosto: ${inAgosto}`);
  console.log(`Animales fuera de agosto: ${fuera}`);
  console.log("\nListo.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
