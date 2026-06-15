-- Registro de actas / observaciones fechadas por animal

CREATE TABLE IF NOT EXISTS actas_animales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id           UUID NOT NULL REFERENCES granjas(id),
  animal_id           UUID NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  fecha               DATE NOT NULL,
  texto               TEXT NOT NULL CHECK (char_length(trim(texto)) > 0),
  autor_nombre        VARCHAR(150),
  registrado_por_id   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_actas_animales_animal_fecha
  ON actas_animales (animal_id, fecha DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_actas_animales_granja
  ON actas_animales (granja_id, created_at DESC);

ALTER TABLE historial_sistema DROP CONSTRAINT IF EXISTS historial_sistema_accion_check;
ALTER TABLE historial_sistema ADD CONSTRAINT historial_sistema_accion_check
  CHECK (accion IN ('crear', 'modificar', 'eliminar', 'vender', 'pesaje', 'acta'));

INSERT INTO actas_animales (granja_id, animal_id, fecha, texto, created_at)
SELECT a.granja_id, a.id, a.fecha_ingreso, trim(a.observaciones), a.created_at
FROM animales a
WHERE a.observaciones IS NOT NULL
  AND trim(a.observaciones) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM actas_animales aa
    WHERE aa.animal_id = a.id AND aa.deleted_at IS NULL
  );
