-- Mensajería y aprobación gerente (SRRG schema español)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION verificar_aprobador(p_email citext, p_password text)
RETURNS TABLE (
  usuario_id uuid,
  nombre text,
  apellido text,
  email text,
  rol_codigo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.apellido,
    u.email::text,
    r.codigo
  FROM usuarios u
  INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
  INNER JOIN roles r ON r.id = ur.rol_id
  WHERE u.email = p_email
    AND u.activo = TRUE
    AND u.deleted_at IS NULL
    AND u.password_hash = crypt(p_password, u.password_hash)
    AND r.codigo IN ('gerente', 'admin');
END;
$$;

CREATE TABLE IF NOT EXISTS solicitudes_aprobacion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granja_id           UUID NOT NULL REFERENCES granjas(id),
  tipo                VARCHAR(50) NOT NULL
    CHECK (tipo IN ('eliminar_animal')),
  registro_id         UUID NOT NULL,
  referencia          VARCHAR(200) NOT NULL,
  justificacion       TEXT NOT NULL,
  solicitante_nombre  VARCHAR(200) NOT NULL,
  solicitante_email   VARCHAR(200),
  solicitante_cargo   VARCHAR(100),
  datos_registro      JSONB,
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  resolucion_notas    TEXT,
  aprobador_id        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelto_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_granja_estado
  ON solicitudes_aprobacion (granja_id, estado, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_pendiente_unica
  ON solicitudes_aprobacion (granja_id, registro_id, tipo)
  WHERE estado = 'pendiente';

INSERT INTO usuarios (id, granja_id, email, password_hash, nombre, apellido, activo) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'gerente@srrg.demo',
    crypt('Gerente123!', gen_salt('bf', 12)),
    'Gerente',
    'SRRG',
    TRUE
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO usuario_roles (usuario_id, rol_id)
SELECT '44444444-4444-4444-4444-444444444444', r.id
FROM roles r WHERE r.codigo = 'gerente'
ON CONFLICT DO NOTHING;
