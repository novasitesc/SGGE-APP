-- Códigos de corrales reutilizables: unicidad solo entre activos + generador en BD.

-- 1) UNIQUE parcial: el mismo código (M1, CQ1…) puede existir en filas soft-deleted.
ALTER TABLE corrales DROP CONSTRAINT IF EXISTS uq_corrales_granja_codigo;

DROP INDEX IF EXISTS uq_corrales_granja_codigo_activos;

CREATE UNIQUE INDEX uq_corrales_granja_codigo_activos
  ON corrales (granja_id, codigo)
  WHERE deleted_at IS NULL;

-- 2) Prefijo por tipo (alineado a lib/modulos/codigo.ts)
CREATE OR REPLACE FUNCTION prefijo_codigo_corral(p_tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_tipo, 'engorda')))
    WHEN 'engorda' THEN 'M'
    WHEN 'leche' THEN 'L'
    WHEN 'cría' THEN 'CR'
    WHEN 'cria' THEN 'CR'
    WHEN 'recría' THEN 'RC'
    WHEN 'recria' THEN 'RC'
    WHEN 'cuarentena' THEN 'CQ'
    WHEN 'enfermeria' THEN 'ENF'
    WHEN 'enfermería' THEN 'ENF'
    ELSE 'X'
  END;
$$;

-- 3) Siguiente código libre entre corrales ACTIVOS (rellena huecos: si borras M1, vuelve M1).
CREATE OR REPLACE FUNCTION siguiente_codigo_corral(
  p_granja_id uuid,
  p_tipo text,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prefix text := prefijo_codigo_corral(p_tipo);
  v_n int := 1;
  v_codigo text;
  v_existe boolean;
BEGIN
  LOOP
    v_codigo := v_prefix || v_n::text;

    SELECT EXISTS (
      SELECT 1
      FROM corrales c
      WHERE c.granja_id = p_granja_id
        AND c.deleted_at IS NULL
        AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
        AND (
          upper(c.codigo) = upper(v_codigo)
          -- Legacy sin número (CQ, ENF) ocupa la secuencia 1
          OR (v_n = 1 AND upper(c.codigo) = upper(v_prefix))
        )
    ) INTO v_existe;

    IF NOT v_existe THEN
      RETURN v_codigo;
    END IF;

    v_n := v_n + 1;
    IF v_n > 10000 THEN
      RAISE EXCEPTION 'No se pudo generar código para tipo %', p_tipo;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION siguiente_codigo_corral IS
  'Devuelve el menor código libre del tipo (M1, CQ1…) solo entre corrales no eliminados.';
