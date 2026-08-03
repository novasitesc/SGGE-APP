-- Módulo Salud (Ola 0): medicamentos, tratamientos, alertas sanitarias
-- Idempotente: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS para entornos
-- que ya tienen tablas parciales en el remoto SRRG.

-- ── Catálogo de medicamentos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id       uuid NOT NULL REFERENCES public.granjas (id),
  codigo          text,
  nombre          text NOT NULL,
  tipo            text NOT NULL DEFAULT 'vacuna',
  unidad_medida   text NOT NULL DEFAULT 'dosis',
  costo_unitario  numeric(14, 4) NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  created_by      uuid,
  updated_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_medicamentos_granja
  ON public.medicamentos (granja_id)
  WHERE deleted_at IS NULL;

-- ── Tratamientos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tratamientos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id            uuid REFERENCES public.granjas (id),
  animal_id            uuid REFERENCES public.animales (id) ON DELETE SET NULL,
  lote_id              uuid,
  medicamento_id       uuid REFERENCES public.medicamentos (id) ON DELETE SET NULL,
  tipo                 text NOT NULL DEFAULT 'vacuna',
  nombre               text,
  fecha_inicio         date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin            date,
  proxima_aplicacion   date,
  animal_count         integer NOT NULL DEFAULT 1 CHECK (animal_count > 0),
  costo_por_animal     numeric(14, 2) NOT NULL DEFAULT 0,
  costo_total          numeric(14, 2) NOT NULL DEFAULT 0,
  estado               text NOT NULL DEFAULT 'aplicado',
  aplicado_por         text NOT NULL DEFAULT '',
  observaciones        text,
  origen               text NOT NULL DEFAULT 'manual',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  created_by           uuid,
  updated_by           uuid
);

-- Columnas nuevas sobre tablas remotas ya existentes
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS granja_id uuid REFERENCES public.granjas (id);
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS lote_id uuid;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'vacuna';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS fecha_fin date;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS proxima_aplicacion date;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS animal_count integer DEFAULT 1;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS costo_por_animal numeric(14, 2) DEFAULT 0;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS aplicado_por text DEFAULT '';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS origen text DEFAULT 'manual';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE INDEX IF NOT EXISTS idx_tratamientos_granja_fecha
  ON public.tratamientos (granja_id, fecha_inicio DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tratamientos_animal
  ON public.tratamientos (animal_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tratamientos_proxima
  ON public.tratamientos (proxima_aplicacion)
  WHERE deleted_at IS NULL AND proxima_aplicacion IS NOT NULL;

-- ── Detalle multi-animal ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tratamiento_animales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos (id) ON DELETE CASCADE,
  animal_id       uuid NOT NULL REFERENCES public.animales (id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tratamiento_id, animal_id)
);

CREATE INDEX IF NOT EXISTS idx_tratamiento_animales_animal
  ON public.tratamiento_animales (animal_id);

-- ── Alertas sanitarias ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alertas_sanitarias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id       uuid NOT NULL REFERENCES public.granjas (id),
  animal_id       uuid REFERENCES public.animales (id) ON DELETE SET NULL,
  tag_id          text,
  tipo            text NOT NULL DEFAULT 'programado',
  mensaje         text NOT NULL,
  fecha_vencimiento date NOT NULL,
  prioridad       text NOT NULL DEFAULT 'media',
  estado          text NOT NULL DEFAULT 'activa',
  tratamiento_id  uuid REFERENCES public.tratamientos (id) ON DELETE SET NULL,
  resuelta_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  created_by      uuid,
  updated_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_alertas_sanitarias_granja
  ON public.alertas_sanitarias (granja_id, fecha_vencimiento)
  WHERE deleted_at IS NULL AND estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_alertas_sanitarias_animal
  ON public.alertas_sanitarias (animal_id)
  WHERE deleted_at IS NULL;

-- ── Importaciones PDF sanitarias (staging) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salud_importaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id        uuid NOT NULL REFERENCES public.granjas (id),
  nombre_archivo   text NOT NULL,
  storage_path     text,
  texto_extraido   text,
  datos_parseados  jsonb,
  estado           text NOT NULL DEFAULT 'pendiente',
  tratamiento_id   uuid REFERENCES public.tratamientos (id) ON DELETE SET NULL,
  error_mensaje    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  created_by       uuid
);

CREATE INDEX IF NOT EXISTS idx_salud_importaciones_granja
  ON public.salud_importaciones (granja_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamiento_animales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_sanitarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salud_importaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medicamentos_granja_access ON public.medicamentos;
CREATE POLICY medicamentos_granja_access ON public.medicamentos
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

DROP POLICY IF EXISTS tratamientos_granja_access ON public.tratamientos;
CREATE POLICY tratamientos_granja_access ON public.tratamientos
  FOR ALL
  USING (
    granja_id IS NULL OR granja_id IN (
      SELECT u.granja_id FROM public.usuarios u
      WHERE u.id = public.current_usuario_id()
    )
  )
  WITH CHECK (
    granja_id IS NULL OR granja_id IN (
      SELECT u.granja_id FROM public.usuarios u
      WHERE u.id = public.current_usuario_id()
    )
  );

DROP POLICY IF EXISTS tratamiento_animales_access ON public.tratamiento_animales;
CREATE POLICY tratamiento_animales_access ON public.tratamiento_animales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tratamientos t
      JOIN public.usuarios u ON u.granja_id = t.granja_id
      WHERE t.id = tratamiento_id AND u.id = public.current_usuario_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tratamientos t
      JOIN public.usuarios u ON u.granja_id = t.granja_id
      WHERE t.id = tratamiento_id AND u.id = public.current_usuario_id()
    )
  );

DROP POLICY IF EXISTS alertas_sanitarias_granja_access ON public.alertas_sanitarias;
CREATE POLICY alertas_sanitarias_granja_access ON public.alertas_sanitarias
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

DROP POLICY IF EXISTS salud_importaciones_granja_access ON public.salud_importaciones;
CREATE POLICY salud_importaciones_granja_access ON public.salud_importaciones
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

COMMENT ON TABLE public.medicamentos IS
  'Catálogo de medicamentos/vacunas por granja (módulo Salud).';
COMMENT ON TABLE public.tratamientos IS
  'Registro de tratamientos sanitarios aplicados al hato.';
COMMENT ON TABLE public.alertas_sanitarias IS
  'Alertas de vencimiento, revisión o urgencia sanitaria.';
COMMENT ON TABLE public.salud_importaciones IS
  'Staging de importación PDF de documentos sanitarios.';
