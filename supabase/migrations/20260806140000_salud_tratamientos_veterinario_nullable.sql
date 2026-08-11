-- Salud: relajar veterinario_id NOT NULL en remoto SRRG legacy.
-- Gestión Salud / PDF / compras VET no siempre tienen veterinario asignado;
-- el aplicativo usa aplicado_por (texto) y created_by.

ALTER TABLE public.tratamientos
  ADD COLUMN IF NOT EXISTS veterinario_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tratamientos'
      AND column_name = 'veterinario_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.tratamientos
      ALTER COLUMN veterinario_id DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.tratamientos.veterinario_id IS
  'Veterinario opcional (legado SRRG). Null permitido; se usa aplicado_por / created_by en el módulo Salud.';
