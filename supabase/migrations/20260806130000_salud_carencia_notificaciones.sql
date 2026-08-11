-- Salud: periodos de carencia (manual de uso) + notificaciones a usuarios.
-- Al aplicar un medicamento se calcula fecha_fin_carencia = fecha_inicio + dias.
-- listo_traslado = true cuando ya puede ir a subasta/traslado/venta.

-- ── Catálogo: días de carencia según ficha / manual de uso ───────────────────
ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS periodo_carencia_dias integer NOT NULL DEFAULT 0
    CHECK (periodo_carencia_dias >= 0);

ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS manual_uso text;

COMMENT ON COLUMN public.medicamentos.periodo_carencia_dias IS
  'Días de retiro/carencia según manual de uso del producto (0 = sin restricción).';
COMMENT ON COLUMN public.medicamentos.manual_uso IS
  'Nota o referencia del manual de uso (periodo, dosis, observaciones).';

-- ── Tratamiento: fin de carencia y aptitud de traslado ───────────────────────
ALTER TABLE public.tratamientos
  ADD COLUMN IF NOT EXISTS fecha_fin_carencia date;

ALTER TABLE public.tratamientos
  ADD COLUMN IF NOT EXISTS listo_traslado boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_tratamientos_fin_carencia
  ON public.tratamientos (granja_id, fecha_fin_carencia)
  WHERE deleted_at IS NULL AND listo_traslado = false;

COMMENT ON COLUMN public.tratamientos.fecha_fin_carencia IS
  'Fecha en que termina la carencia (aplicación + periodo_carencia_dias).';
COMMENT ON COLUMN public.tratamientos.listo_traslado IS
  'True cuando el animal/hato ya puede trasladarse a subasta/venta.';

-- ── Notificaciones in-app por usuario ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificaciones_usuario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id        uuid NOT NULL REFERENCES public.granjas (id),
  usuario_id       uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  tipo             text NOT NULL,
  titulo           text NOT NULL,
  mensaje          text NOT NULL,
  tratamiento_id   uuid REFERENCES public.tratamientos (id) ON DELETE SET NULL,
  animal_id        uuid REFERENCES public.animales (id) ON DELETE SET NULL,
  fecha_evento     date,
  leida_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tipo, tratamiento_id)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_inbox
  ON public.notificaciones_usuario (usuario_id, created_at DESC)
  WHERE leida_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_granja
  ON public.notificaciones_usuario (granja_id, created_at DESC);

ALTER TABLE public.notificaciones_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_usuario_own ON public.notificaciones_usuario;
CREATE POLICY notificaciones_usuario_own ON public.notificaciones_usuario
  FOR ALL
  USING (usuario_id = public.current_usuario_id())
  WITH CHECK (usuario_id = public.current_usuario_id());

COMMENT ON TABLE public.notificaciones_usuario IS
  'Bandeja in-app: carencia próxima/vencida y eventos sanitarios por usuario.';
