-- Bodega: compras de abono/fertilizantes (FERT) y herbicidas (HERB).
-- Cada fila se alinea a `gastos` vía gasto_id único (mismo patrón que obligaciones).
-- Idempotente: categorías, enum, tabla, índices, trigger y RLS.

INSERT INTO public.categorias_gastos (codigo, nombre)
SELECT v.codigo, v.nombre
FROM (
  VALUES
    ('FERT', 'Abono y fertilizantes'),
    ('HERB', 'Herbicidas')
) AS v(codigo, nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_gastos c WHERE c.codigo = v.codigo
);

DO $$ BEGIN
  CREATE TYPE public.bodega_linea AS ENUM ('fertilizante', 'herbicida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.bodega_compras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id       uuid NOT NULL REFERENCES public.granjas (id),
  linea           public.bodega_linea NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  proveedor       text NOT NULL DEFAULT '',
  producto        text NOT NULL DEFAULT '',
  cantidad        numeric(14, 3),
  unidad          text NOT NULL DEFAULT 'kg',
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_bodega_compras_gasto_activos
  ON public.bodega_compras (gasto_id)
  WHERE deleted_at IS NULL AND gasto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bodega_compras_granja_fecha
  ON public.bodega_compras (granja_id, fecha DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bodega_compras_granja_linea
  ON public.bodega_compras (granja_id, linea)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_bodega_compras ON public.bodega_compras;
CREATE TRIGGER set_updated_at_bodega_compras
  BEFORE UPDATE ON public.bodega_compras
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bodega_compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bodega_compras_granja_access ON public.bodega_compras;
CREATE POLICY bodega_compras_granja_access ON public.bodega_compras
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

COMMENT ON TABLE public.bodega_compras IS
  'Compras de bodega (abono/fertilizantes y herbicidas). El monto vive también en gastos (FERT/HERB).';
