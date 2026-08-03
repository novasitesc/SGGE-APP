-- Alimentaciones / entregas de ración (alineado al schema remoto SRRG)
-- Idempotente: CREATE IF NOT EXISTS para entornos que ya tienen las tablas.

CREATE TABLE IF NOT EXISTS public.alimentaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id     uuid NOT NULL REFERENCES public.granjas (id),
  lote_id       uuid,
  animal_id     uuid,
  fecha         date NOT NULL,
  turno         text,
  costo_total   numeric(14, 2) NOT NULL DEFAULT 0,
  observaciones text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  created_by    uuid,
  updated_by    uuid,
  -- Remoto: chk_alimentacion_destino exige lote_id OR animal_id
  CONSTRAINT chk_alimentacion_destino CHECK (lote_id IS NOT NULL OR animal_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_alimentaciones_granja_fecha
  ON public.alimentaciones (granja_id, fecha DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.detalle_alimentaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alimentacion_id uuid NOT NULL REFERENCES public.alimentaciones (id) ON DELETE CASCADE,
  alimento_id     uuid NOT NULL REFERENCES public.alimentos (id),
  cantidad        numeric(14, 3) NOT NULL CHECK (cantidad > 0),
  costo_unitario  numeric(14, 4) NOT NULL DEFAULT 0,
  subtotal        numeric(14, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_detalle_alimentaciones_alimentacion
  ON public.detalle_alimentaciones (alimentacion_id);

CREATE INDEX IF NOT EXISTS idx_detalle_alimentaciones_alimento
  ON public.detalle_alimentaciones (alimento_id);

COMMENT ON TABLE public.alimentaciones IS
  'Cabecera de entrega/ración diaria. Alimenta KPIs de /feeding (horizonte 30d).';
COMMENT ON TABLE public.detalle_alimentaciones IS
  'Líneas de insumo por entrega (cantidad × costo_unitario = subtotal).';
