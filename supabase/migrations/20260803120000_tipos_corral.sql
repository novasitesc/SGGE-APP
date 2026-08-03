-- Catálogo administrable de tipos de corral / módulo.
-- Idempotente: entornos que ya tengan la tabla no se rompen.

CREATE TABLE IF NOT EXISTS public.tipos_corral (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL,
  nombre      text NOT NULL,
  prefijo     text NOT NULL DEFAULT 'X',
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT uq_tipos_corral_codigo UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_tipos_corral_activos
  ON public.tipos_corral (codigo)
  WHERE deleted_at IS NULL AND activo = true;

COMMENT ON TABLE public.tipos_corral IS
  'Clasificación operativa de módulos/corrales (engorda, cuarentena, etc.).';

-- Semilla alineada a lib/modulos/constants.ts (solo si la tabla está vacía).
INSERT INTO public.tipos_corral (codigo, nombre, prefijo, activo)
SELECT v.codigo, v.nombre, v.prefijo, true
FROM (
  VALUES
    ('engorda', 'Engorda', 'M'),
    ('leche', 'Leche', 'L'),
    ('cría', 'Cría', 'CR'),
    ('recría', 'Recría', 'RC'),
    ('cuarentena', 'Cuarentena', 'CQ'),
    ('enfermeria', 'Enfermería', 'ENF')
) AS v(codigo, nombre, prefijo)
WHERE NOT EXISTS (SELECT 1 FROM public.tipos_corral LIMIT 1)
ON CONFLICT (codigo) DO NOTHING;
