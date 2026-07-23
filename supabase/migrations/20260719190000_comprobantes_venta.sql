-- Amplía las clasificaciones permitidas de `comprobantes` para soportar el
-- flujo "comprobante → Venta" (facturas de venta emitidas por la propia granja)
-- y la clasificación explícita "ignorar" (p. ej. mensajes de aceptación que
-- duplican una factura ya contabilizada).
--
-- Antes:  clasificacion IN ('gasto','compra_ganado','pendiente')
-- Después: clasificacion IN ('gasto','compra_ganado','venta','ignorar','pendiente')
--
-- El enlace comprobante ↔ venta se hace vía `comprobantes.factura_id`
-- (facturas.tipo = 'ingreso', facturas.venta_id → ventas.id); no se agrega
-- ninguna columna nueva.
--
-- Idempotente: se puede ejecutar varias veces sin error.

do $$
declare
  v_conname text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'comprobantes'
  ) then
    raise notice 'Tabla comprobantes no existe; se omite.';
    return;
  end if;

  -- Eliminar el CHECK actual que restringe `clasificacion` (nombre variable).
  select con.conname
    into v_conname
  from pg_constraint con
  where con.conrelid = 'public.comprobantes'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%clasificacion%';

  if v_conname is not null then
    execute format('alter table public.comprobantes drop constraint %I', v_conname);
  end if;

  alter table public.comprobantes
    add constraint comprobantes_clasificacion_check
    check (clasificacion in ('gasto','compra_ganado','venta','ignorar','pendiente'));
end $$;
