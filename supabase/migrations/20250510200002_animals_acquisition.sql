-- Campos de compra / subasta (factura o remate) en animales

alter table public.animals
  add column if not exists acquisition_type text
    check (acquisition_type is null or acquisition_type in ('subasta', 'particular', 'otro'));

alter table public.animals add column if not exists invoice_folio text;
alter table public.animals add column if not exists invoice_or_auction_date date;
alter table public.animals add column if not exists auction_lot_number text;
alter table public.animals add column if not exists purchase_price_per_kg numeric(12, 2);

comment on column public.animals.acquisition_type is 'Origen: subasta, particular u otro.';
comment on column public.animals.invoice_folio is 'Folio visible de la factura de compra.';
comment on column public.animals.invoice_or_auction_date is 'Fecha del remate o de la factura.';
comment on column public.animals.auction_lot_number is 'Número de lote en subasta.';
comment on column public.animals.purchase_price_per_kg is 'Precio de compra $/kg al ingreso.';
