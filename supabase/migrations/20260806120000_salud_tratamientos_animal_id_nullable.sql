-- Salud: alinear `tratamientos` al modelo de hato (animal_id opcional).
--
-- El remoto SRRG ya tenía `tratamientos` con `animal_id NOT NULL`.
-- La migración Ola 0 usaba CREATE IF NOT EXISTS, así que no relajó el constraint.
-- Gestión Salud, PDF y compras VET registran a nivel de hato/stock sin animal concreto.

-- ── Columnas que pueden faltar en tablas remotas parciales ───────────────────
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS granja_id uuid REFERENCES public.granjas (id);
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS medicamento_id uuid REFERENCES public.medicamentos (id) ON DELETE SET NULL;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS lote_id uuid;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'vacuna';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS fecha_inicio date DEFAULT CURRENT_DATE;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS fecha_fin date;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS proxima_aplicacion date;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS animal_count integer DEFAULT 1;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS costo_por_animal numeric(14, 2) DEFAULT 0;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS costo_total numeric(14, 2) DEFAULT 0;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS estado text DEFAULT 'aplicado';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS aplicado_por text DEFAULT '';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS observaciones text;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS origen text DEFAULT 'manual';
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS updated_by uuid;

-- animal_id: crear si falta (nullable) o relajar NOT NULL si ya existía
ALTER TABLE public.tratamientos ADD COLUMN IF NOT EXISTS animal_id uuid;

DO $$
BEGIN
  -- Quitar NOT NULL (causa del error en /gestion/salud)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tratamientos'
      AND column_name = 'animal_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.tratamientos ALTER COLUMN animal_id DROP NOT NULL;
  END IF;

  -- Asegurar FK a animales con ON DELETE SET NULL (idempotente)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tratamientos_animal_id_fkey'
      AND conrelid = 'public.tratamientos'::regclass
  ) THEN
    ALTER TABLE public.tratamientos
      ADD CONSTRAINT tratamientos_animal_id_fkey
      FOREIGN KEY (animal_id)
      REFERENCES public.animales (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.tratamientos.animal_id IS
  'Animal opcional. Null = aplicación a nivel de hato/stock (animal_count). Detalle multi-animal en tratamiento_animales.';

-- Tablas satélite del módulo (por si el remoto no las tiene)
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

CREATE TABLE IF NOT EXISTS public.tratamiento_animales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratamiento_id  uuid NOT NULL REFERENCES public.tratamientos (id) ON DELETE CASCADE,
  animal_id       uuid NOT NULL REFERENCES public.animales (id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tratamiento_id, animal_id)
);

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

ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamiento_animales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_sanitarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salud_importaciones ENABLE ROW LEVEL SECURITY;
