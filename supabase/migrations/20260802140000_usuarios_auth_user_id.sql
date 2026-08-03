-- Ola 1: puente entre public.usuarios y Supabase Auth (auth.users)
-- Tras crear el usuario en Auth (Dashboard o admin API), enlazar:
--   UPDATE public.usuarios SET auth_user_id = '<auth.users.id>' WHERE email = '...';

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_user_id
  ON public.usuarios (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.usuarios.auth_user_id IS
  'FK a auth.users.id — sesión Supabase Auth del usuario de negocio.';

CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND u.activo = TRUE
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_usuario_id() IS
  'Devuelve usuarios.id del JWT actual (auth.uid → auth_user_id).';
