-- Separación de poderes: solo admin autoriza (gerente solicita / opera).
-- Actualiza RPC legacy verificar_aprobador para alinear con Auth Ola 1.

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
    AND r.codigo = 'admin';
END;
$$;

COMMENT ON FUNCTION verificar_aprobador(citext, text) IS
  'Legacy: verifica credenciales de aprobador. Solo rol admin. Preferir sesión Auth + aprobadorDesdeSesion.';

-- Para asignar rol admin a un usuario existente (ejemplo):
-- INSERT INTO usuario_roles (usuario_id, rol_id)
-- SELECT u.id, r.id
-- FROM usuarios u
-- CROSS JOIN roles r
-- WHERE u.email = 'admin@srrg.demo'
--   AND r.codigo = 'admin'
-- ON CONFLICT DO NOTHING;
