  -- Obligaciones de la granja (Costa Rica): servicios públicos, pólizas INS,
  -- CCSS, salarios y viáticos. Cada fila de dominio se alinea a `gastos`
  -- (fuente de verdad del monto) vía gasto_id único.
  -- Idempotente: tipos, categorías, tablas, RLS, índices y backfill conocido.

  -- ── Enums ────────────────────────────────────────────────────────────────────
  DO $$ BEGIN
    CREATE TYPE public.tipo_servicio_publico AS ENUM (
      'electricidad', 'agua', 'telecomunicaciones', 'internet', 'otro'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  DO $$ BEGIN
    CREATE TYPE public.tipo_poliza AS ENUM (
      'riesgos_trabajo', 'vehiculo', 'ganadero', 'incendio', 'otro'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  DO $$ BEGIN
    CREATE TYPE public.estado_poliza AS ENUM (
      'vigente', 'vencida', 'cancelada'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  DO $$ BEGIN
    CREATE TYPE public.tipo_aporte_ccss AS ENUM (
      'cuota_obrero_patronal', 'ivm', 'sem', 'otro'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  DO $$ BEGIN
    CREATE TYPE public.tipo_salario AS ENUM (
      'ordinario', 'extraordinario', 'aguinaldo', 'liquidacion', 'otro'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

-- ── Catálogo de gastos (puede no existir fuera del remoto SRRG) ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'granjas'
  ) THEN
    RAISE EXCEPTION
      'Falta public.granjas. Ejecute esta migración en el proyecto SRRG (esquema español), no en farms/costs.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.categorias_gastos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL,
  nombre      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_gastos_codigo
  ON public.categorias_gastos (codigo);

CREATE TABLE IF NOT EXISTS public.gastos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id     uuid NOT NULL REFERENCES public.granjas (id),
  categoria_id  uuid REFERENCES public.categorias_gastos (id),
  fecha         date NOT NULL DEFAULT CURRENT_DATE,
  concepto      text NOT NULL DEFAULT '',
  monto         numeric(14, 2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  referencia    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX IF NOT EXISTS idx_gastos_granja_fecha
  ON public.gastos (granja_id, fecha DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_categoria
  ON public.gastos (categoria_id)
  WHERE deleted_at IS NULL;

INSERT INTO public.categorias_gastos (codigo, nombre)
SELECT v.codigo, v.nombre
FROM (
  VALUES
    ('ALIM', 'Alimentación'),
    ('COMB', 'Combustible'),
    ('MANT', 'Mantenimiento'),
    ('SERV', 'Servicios'),
    ('TRANS', 'Transporte'),
    ('MO',   'Mano de obra'),
    ('VET',  'Veterinaria'),
    ('OTRO', 'Otros'),
    ('SPUB', 'Servicios públicos'),
    ('POL',  'Pólizas'),
    ('CCSS', 'Caja Costarricense de Seguro Social'),
    ('SAL',  'Salarios'),
    ('VIAT', 'Viáticos')
) AS v(codigo, nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_gastos c WHERE c.codigo = v.codigo
);

  -- ── Empleados ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.empleados (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id     uuid NOT NULL REFERENCES public.granjas (id),
    nombre        text NOT NULL,
    apellido      text,
    cedula        text,
    puesto        text,
    fecha_ingreso date,
    activo        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    created_by    uuid,
    updated_by    uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_empleados_granja_cedula_activos
    ON public.empleados (granja_id, cedula)
    WHERE deleted_at IS NULL AND cedula IS NOT NULL AND btrim(cedula) <> '';

  CREATE INDEX IF NOT EXISTS idx_empleados_granja
    ON public.empleados (granja_id)
    WHERE deleted_at IS NULL;

  DROP TRIGGER IF EXISTS set_updated_at_empleados ON public.empleados;
  CREATE TRIGGER set_updated_at_empleados
    BEFORE UPDATE ON public.empleados
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Servicios públicos ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.servicios_publicos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id       uuid NOT NULL REFERENCES public.granjas (id),
    tipo            public.tipo_servicio_publico NOT NULL DEFAULT 'otro',
    proveedor       text NOT NULL DEFAULT '',
    numero_cuenta   text,
    periodo_inicio  date,
    periodo_fin     date,
    fecha_pago      date NOT NULL DEFAULT CURRENT_DATE,
    monto           numeric(14, 2) NOT NULL CHECK (monto >= 0),
    concepto        text NOT NULL DEFAULT '',
    gasto_id        uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
    comprobante_id  uuid,
    origen          text NOT NULL DEFAULT 'manual'
                      CHECK (origen IN ('manual', 'comprobante')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    created_by      uuid,
    updated_by      uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_servicios_publicos_gasto_activos
    ON public.servicios_publicos (gasto_id)
    WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_servicios_publicos_granja_fecha
    ON public.servicios_publicos (granja_id, fecha_pago DESC)
    WHERE deleted_at IS NULL;

  DROP TRIGGER IF EXISTS set_updated_at_servicios_publicos ON public.servicios_publicos;
  CREATE TRIGGER set_updated_at_servicios_publicos
    BEFORE UPDATE ON public.servicios_publicos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Pólizas (catálogo) ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.polizas (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id        uuid NOT NULL REFERENCES public.granjas (id),
    aseguradora      text NOT NULL DEFAULT 'INS',
    numero_poliza    text NOT NULL,
    tipo             public.tipo_poliza NOT NULL DEFAULT 'otro',
    vigencia_desde   date,
    vigencia_hasta   date,
    prima_total      numeric(14, 2),
    estado           public.estado_poliza NOT NULL DEFAULT 'vigente',
    notas            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    created_by       uuid,
    updated_by       uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_polizas_granja_numero_activas
    ON public.polizas (granja_id, numero_poliza)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_polizas_granja_estado
    ON public.polizas (granja_id, estado)
    WHERE deleted_at IS NULL;

  DROP TRIGGER IF EXISTS set_updated_at_polizas ON public.polizas;
  CREATE TRIGGER set_updated_at_polizas
    BEFORE UPDATE ON public.polizas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Pagos de póliza ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.poliza_pagos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id       uuid NOT NULL REFERENCES public.granjas (id),
    poliza_id       uuid NOT NULL REFERENCES public.polizas (id) ON DELETE CASCADE,
    fecha           date NOT NULL DEFAULT CURRENT_DATE,
    monto           numeric(14, 2) NOT NULL CHECK (monto >= 0),
    periodo_desde   date,
    periodo_hasta   date,
    concepto        text NOT NULL DEFAULT '',
    gasto_id        uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
    comprobante_id  uuid,
    origen          text NOT NULL DEFAULT 'manual'
                      CHECK (origen IN ('manual', 'comprobante')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    created_by      uuid,
    updated_by      uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_poliza_pagos_gasto_activos
    ON public.poliza_pagos (gasto_id)
    WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_poliza_pagos_poliza_fecha
    ON public.poliza_pagos (poliza_id, fecha DESC)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_poliza_pagos_granja_fecha
    ON public.poliza_pagos (granja_id, fecha DESC)
    WHERE deleted_at IS NULL;

  DROP TRIGGER IF EXISTS set_updated_at_poliza_pagos ON public.poliza_pagos;
  CREATE TRIGGER set_updated_at_poliza_pagos
    BEFORE UPDATE ON public.poliza_pagos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Aportes CCSS ─────────────────────────────────────────────────────────────
  -- Varios pagos por período son válidos (abonos); unicidad va por gasto_id.
  CREATE TABLE IF NOT EXISTS public.aportes_ccss (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id       uuid NOT NULL REFERENCES public.granjas (id),
    periodo         char(6) NOT NULL,
    tipo            public.tipo_aporte_ccss NOT NULL DEFAULT 'cuota_obrero_patronal',
    numero_patrono  text,
    fecha_pago      date NOT NULL DEFAULT CURRENT_DATE,
    monto           numeric(14, 2) NOT NULL CHECK (monto >= 0),
    concepto        text NOT NULL DEFAULT '',
    gasto_id        uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
    comprobante_id  uuid,
    origen          text NOT NULL DEFAULT 'manual'
                      CHECK (origen IN ('manual', 'comprobante')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    created_by      uuid,
    updated_by      uuid,
    CONSTRAINT chk_aportes_ccss_periodo CHECK (periodo ~ '^[0-9]{6}$')
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_aportes_ccss_gasto_activos
    ON public.aportes_ccss (gasto_id)
    WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_aportes_ccss_granja_periodo
    ON public.aportes_ccss (granja_id, periodo DESC)
    WHERE deleted_at IS NULL;

  DROP TRIGGER IF EXISTS set_updated_at_aportes_ccss ON public.aportes_ccss;
  CREATE TRIGGER set_updated_at_aportes_ccss
    BEFORE UPDATE ON public.aportes_ccss
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Salarios ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.salarios (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id        uuid NOT NULL REFERENCES public.granjas (id),
    empleado_id      uuid REFERENCES public.empleados (id) ON DELETE SET NULL,
    empleado_nombre  text NOT NULL DEFAULT '',
    periodo_inicio   date,
    periodo_fin      date,
    tipo             public.tipo_salario NOT NULL DEFAULT 'ordinario',
    monto            numeric(14, 2) NOT NULL CHECK (monto >= 0),
    fecha_pago       date NOT NULL DEFAULT CURRENT_DATE,
    concepto         text NOT NULL DEFAULT '',
    gasto_id         uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
    comprobante_id   uuid,
    origen           text NOT NULL DEFAULT 'manual'
                      CHECK (origen IN ('manual', 'comprobante')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    created_by       uuid,
    updated_by       uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_salarios_gasto_activos
    ON public.salarios (gasto_id)
    WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_salarios_granja_fecha
    ON public.salarios (granja_id, fecha_pago DESC)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_salarios_empleado
    ON public.salarios (empleado_id)
    WHERE deleted_at IS NULL AND empleado_id IS NOT NULL;

  DROP TRIGGER IF EXISTS set_updated_at_salarios ON public.salarios;
  CREATE TRIGGER set_updated_at_salarios
    BEFORE UPDATE ON public.salarios
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── Viáticos ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS public.viaticos (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    granja_id        uuid NOT NULL REFERENCES public.granjas (id),
    empleado_id      uuid REFERENCES public.empleados (id) ON DELETE SET NULL,
    empleado_nombre  text NOT NULL DEFAULT '',
    fecha            date NOT NULL DEFAULT CURRENT_DATE,
    destino          text NOT NULL DEFAULT '',
    motivo           text,
    monto            numeric(14, 2) NOT NULL CHECK (monto >= 0),
    gasto_id         uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
    comprobante_id   uuid,
    origen           text NOT NULL DEFAULT 'manual'
                      CHECK (origen IN ('manual', 'comprobante')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    created_by       uuid,
    updated_by       uuid
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_viaticos_gasto_activos
    ON public.viaticos (gasto_id)
    WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_viaticos_granja_fecha
    ON public.viaticos (granja_id, fecha DESC)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_viaticos_empleado
    ON public.viaticos (empleado_id)
    WHERE deleted_at IS NULL AND empleado_id IS NOT NULL;

  DROP TRIGGER IF EXISTS set_updated_at_viaticos ON public.viaticos;
  CREATE TRIGGER set_updated_at_viaticos
    BEFORE UPDATE ON public.viaticos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- ── RLS ──────────────────────────────────────────────────────────────────────
  ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.servicios_publicos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.polizas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.poliza_pagos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.aportes_ccss ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.salarios ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.viaticos ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS empleados_granja_access ON public.empleados;
  CREATE POLICY empleados_granja_access ON public.empleados
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS servicios_publicos_granja_access ON public.servicios_publicos;
  CREATE POLICY servicios_publicos_granja_access ON public.servicios_publicos
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS polizas_granja_access ON public.polizas;
  CREATE POLICY polizas_granja_access ON public.polizas
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS poliza_pagos_granja_access ON public.poliza_pagos;
  CREATE POLICY poliza_pagos_granja_access ON public.poliza_pagos
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.polizas p
        JOIN public.usuarios u ON u.granja_id = p.granja_id
        WHERE p.id = poliza_id AND u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.polizas p
        JOIN public.usuarios u ON u.granja_id = p.granja_id
        WHERE p.id = poliza_id AND u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS aportes_ccss_granja_access ON public.aportes_ccss;
  CREATE POLICY aportes_ccss_granja_access ON public.aportes_ccss
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS salarios_granja_access ON public.salarios;
  CREATE POLICY salarios_granja_access ON public.salarios
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

  DROP POLICY IF EXISTS viaticos_granja_access ON public.viaticos;
  CREATE POLICY viaticos_granja_access ON public.viaticos
    FOR ALL
    USING (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    )
    WITH CHECK (
      granja_id IN (
        SELECT u.granja_id FROM public.usuarios u
        WHERE u.id = public.current_usuario_id()
      )
    );

-- ── FKs opcionales a comprobantes ────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicios_publicos_comprobante_id_fkey'
  ) THEN
    ALTER TABLE public.servicios_publicos
      ADD CONSTRAINT servicios_publicos_comprobante_id_fkey
      FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'poliza_pagos_comprobante_id_fkey'
  ) THEN
    ALTER TABLE public.poliza_pagos
      ADD CONSTRAINT poliza_pagos_comprobante_id_fkey
      FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aportes_ccss_comprobante_id_fkey'
  ) THEN
    ALTER TABLE public.aportes_ccss
      ADD CONSTRAINT aportes_ccss_comprobante_id_fkey
      FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salarios_comprobante_id_fkey'
  ) THEN
    ALTER TABLE public.salarios
      ADD CONSTRAINT salarios_comprobante_id_fkey
      FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viaticos_comprobante_id_fkey'
  ) THEN
    ALTER TABLE public.viaticos
      ADD CONSTRAINT viaticos_comprobante_id_fkey
      FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Backfill: INS → POL + póliza 8316104 ─────────────────────────────────────
UPDATE public.gastos g
SET categoria_id = cat.id
FROM public.categorias_gastos cat
WHERE cat.codigo = 'POL'
  AND g.deleted_at IS NULL
  AND g.categoria_id IS DISTINCT FROM cat.id
  AND (
    g.concepto ILIKE '%póliza%'
    OR g.concepto ILIKE '%poliza%'
    OR g.concepto ILIKE '%riesgos del trabajo%'
  );

DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.gastos g
  SET categoria_id = cat.id
  FROM public.categorias_gastos cat
  WHERE cat.codigo = 'POL'
    AND g.deleted_at IS NULL
    AND g.categoria_id IS DISTINCT FROM cat.id
    AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.gasto_id = g.id
        AND c.deleted_at IS NULL
        AND (
          c.emisor_identificacion IN ('4000001902')
          OR coalesce(c.emisor_nombre, '') ILIKE '%instituto nacional de seguros%'
        )
    );
END $$;

INSERT INTO public.polizas (
  granja_id, aseguradora, numero_poliza, tipo,
  vigencia_desde, vigencia_hasta, estado, notas
)
SELECT DISTINCT
  g.granja_id,
  'INS',
  '8316104',
  'riesgos_trabajo'::public.tipo_poliza,
  DATE '2026-07-01',
  DATE '2026-09-30',
  'vigente'::public.estado_poliza,
  'Backfill desde comprobante INS — Riesgos del Trabajo'
FROM public.gastos g
JOIN public.categorias_gastos cat ON cat.id = g.categoria_id AND cat.codigo = 'POL'
WHERE g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.polizas p
    WHERE p.granja_id = g.granja_id
      AND p.numero_poliza = '8316104'
      AND p.deleted_at IS NULL
  );

INSERT INTO public.poliza_pagos (
  granja_id, poliza_id, fecha, monto, periodo_desde, periodo_hasta,
  concepto, gasto_id, comprobante_id, origen
)
SELECT
  g.granja_id,
  p.id,
  g.fecha,
  g.monto,
  DATE '2026-07-01',
  DATE '2026-09-30',
  g.concepto,
  g.id,
  NULL,
  'manual'
FROM public.gastos g
JOIN public.categorias_gastos cat ON cat.id = g.categoria_id AND cat.codigo = 'POL'
JOIN public.polizas p
  ON p.granja_id = g.granja_id
 AND p.numero_poliza = '8316104'
 AND p.deleted_at IS NULL
WHERE g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.poliza_pagos pp
    WHERE pp.gasto_id = g.id AND pp.deleted_at IS NULL
  );

DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.poliza_pagos pp
  SET
    comprobante_id = c.id,
    origen = 'comprobante'
  FROM public.comprobantes c
  WHERE c.gasto_id = pp.gasto_id
    AND c.deleted_at IS NULL
    AND pp.deleted_at IS NULL
    AND pp.comprobante_id IS NULL;
END $$;

-- ── Backfill: CCSS (concepto/emisor) ─────────────────────────────────────────
UPDATE public.gastos g
SET categoria_id = cat.id
FROM public.categorias_gastos cat
WHERE cat.codigo = 'CCSS'
  AND g.deleted_at IS NULL
  AND g.categoria_id IS DISTINCT FROM cat.id
  AND (
    g.concepto ILIKE '%ccss%'
    OR g.concepto ILIKE '%caja costarricense%'
    OR g.concepto ILIKE '%cuota obrero%'
  );

DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.gastos g
  SET categoria_id = cat.id
  FROM public.categorias_gastos cat
  WHERE cat.codigo = 'CCSS'
    AND g.deleted_at IS NULL
    AND g.categoria_id IS DISTINCT FROM cat.id
    AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.gasto_id = g.id
        AND c.deleted_at IS NULL
        AND (
          coalesce(c.emisor_nombre, '') ILIKE '%ccss%'
          OR coalesce(c.emisor_nombre, '') ILIKE '%caja costarricense%'
        )
    );
END $$;

INSERT INTO public.aportes_ccss (
  granja_id, periodo, tipo, fecha_pago, monto, concepto,
  gasto_id, comprobante_id, origen
)
SELECT
  g.granja_id,
  COALESCE(
    substring(g.concepto from '([0-9]{6})'),
    to_char(g.fecha, 'YYYYMM')
  ),
  'cuota_obrero_patronal'::public.tipo_aporte_ccss,
  g.fecha,
  g.monto,
  g.concepto,
  g.id,
  NULL,
  'manual'
FROM public.gastos g
JOIN public.categorias_gastos cat ON cat.id = g.categoria_id AND cat.codigo = 'CCSS'
WHERE g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.aportes_ccss a
    WHERE a.gasto_id = g.id AND a.deleted_at IS NULL
  );

DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.aportes_ccss a
  SET
    comprobante_id = c.id,
    origen = 'comprobante'
  FROM public.comprobantes c
  WHERE c.gasto_id = a.gasto_id
    AND c.deleted_at IS NULL
    AND a.deleted_at IS NULL
    AND a.comprobante_id IS NULL;
END $$;

-- ── Backfill: planillas MO → SAL ─────────────────────────────────────────────
UPDATE public.gastos g
SET categoria_id = cat.id
FROM public.categorias_gastos cat
JOIN public.categorias_gastos mo ON mo.codigo = 'MO'
WHERE cat.codigo = 'SAL'
  AND g.deleted_at IS NULL
  AND g.categoria_id = mo.id
  AND g.concepto ILIKE 'Planilla%';

INSERT INTO public.salarios (
  granja_id, empleado_nombre, tipo, monto, fecha_pago, concepto,
  gasto_id, comprobante_id, origen
)
SELECT
  g.granja_id,
  'Planilla',
  'ordinario'::public.tipo_salario,
  g.monto,
  g.fecha,
  g.concepto,
  g.id,
  NULL,
  'manual'
FROM public.gastos g
JOIN public.categorias_gastos cat ON cat.id = g.categoria_id AND cat.codigo = 'SAL'
WHERE g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.salarios s
    WHERE s.gasto_id = g.id AND s.deleted_at IS NULL
  );

DO $$
BEGIN
  IF to_regclass('public.comprobantes') IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.salarios s
  SET
    comprobante_id = c.id,
    origen = 'comprobante'
  FROM public.comprobantes c
  WHERE c.gasto_id = s.gasto_id
    AND c.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.comprobante_id IS NULL;
END $$;

  COMMENT ON TABLE public.empleados IS
    'Catálogo de personal de la granja (salarios y viáticos).';
  COMMENT ON TABLE public.servicios_publicos IS
    'Recibos ICE/AyA/telecom. Monto alineado a gastos (categoría SPUB).';
  COMMENT ON TABLE public.polizas IS
    'Pólizas vigentes (INS y otras). Los pagos viven en poliza_pagos.';
  COMMENT ON TABLE public.poliza_pagos IS
    'Pagos de prima. Monto alineado a gastos (categoría POL).';
  COMMENT ON TABLE public.aportes_ccss IS
    'Cuotas obrero-patronales y otros aportes CCSS (categoría CCSS).';
  COMMENT ON TABLE public.salarios IS
    'Pagos de planilla / salario (categoría SAL). MO queda para jornales sueltos.';
  COMMENT ON TABLE public.viaticos IS
    'Viáticos de personal (categoría VIAT).';
