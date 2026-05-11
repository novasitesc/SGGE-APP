-- SGGE: esquema inicial (PostgreSQL / Supabase)
-- Ejecutar con: supabase db push / SQL Editor en el panel de Supabase

create extension if not exists "pgcrypto";

-- ─── Tipos enumerados (alineados al frontend) ─────────────────────────────

create type public.animal_status as enum ('activo', 'vendido', 'muerto', 'enfermo');

create type public.module_type as enum ('engorda', 'leche', 'cría', 'recría');

create type public.cost_category as enum (
  'transporte',
  'alimentación',
  'vacunas',
  'mano_de_obra',
  'servicios',
  'medicamentos',
  'otros'
);

create type public.treatment_type as enum (
  'vacuna',
  'desparasitante',
  'implante',
  'anabólico',
  'vitamina',
  'antibiótico'
);

create type public.alert_type as enum ('tratamiento', 'revisión', 'urgente', 'programado');

create type public.alert_priority as enum ('alta', 'media', 'baja');

-- ─── Tablas ─────────────────────────────────────────────────────────────────

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  code text not null,
  name text not null,
  type public.module_type not null,
  capacity integer not null check (capacity > 0),
  location text not null default '',
  supervisor text not null default '',
  created_at timestamptz not null default now(),
  unique (farm_id, code)
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  tag_id text not null,
  breed text not null,
  entry_date date not null,
  initial_weight numeric(10, 2) not null check (initial_weight >= 0),
  current_weight numeric(10, 2) not null check (current_weight >= 0),
  module_id uuid references public.modules (id) on delete set null,
  status public.animal_status not null default 'activo',
  sex char(1) not null check (sex in ('M', 'H')),
  age_months integer not null default 0 check (age_months >= 0),
  acquisition_type text
    check (acquisition_type is null or acquisition_type in ('subasta', 'particular', 'otro')),
  invoice_folio text,
  invoice_or_auction_date date,
  auction_lot_number text,
  purchase_price_per_kg numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, tag_id)
);

comment on column public.animals.acquisition_type is 'Origen: subasta, particular u otro.';
comment on column public.animals.invoice_folio is 'Folio visible de la factura de compra.';
comment on column public.animals.invoice_or_auction_date is 'Fecha del remate o de la factura.';
comment on column public.animals.auction_lot_number is 'Número de lote en subasta.';
comment on column public.animals.purchase_price_per_kg is 'Precio de compra $/kg al ingreso.';

create index idx_animals_farm_status on public.animals (farm_id, status);
create index idx_animals_module on public.animals (module_id);

create table public.weight_measurements (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(10, 2) not null check (weight_kg > 0)
);

create index idx_weight_animal_measured on public.weight_measurements (animal_id, measured_at desc);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  category public.cost_category not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  date date not null,
  animal_count integer null check (animal_count is null or animal_count >= 0),
  created_at timestamptz not null default now()
);

create index idx_costs_farm_date on public.costs (farm_id, date desc);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type public.treatment_type not null,
  name text not null,
  date date not null,
  animal_count integer not null check (animal_count > 0),
  cost_per_animal numeric(12, 2) not null check (cost_per_animal >= 0),
  total_cost numeric(14, 2) not null check (total_cost >= 0),
  applied_by text not null default '',
  notes text not null default '',
  next_due date null,
  created_at timestamptz not null default now(),
  constraint treatments_cost_consistency check (
    abs(total_cost - round((animal_count::numeric * cost_per_animal), 2)) < 0.02
  )
);

create index idx_treatments_farm_date on public.treatments (farm_id, date desc);

create table public.health_alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid references public.animals (id) on delete set null,
  tag_id text null,
  type public.alert_type not null,
  message text not null,
  due_date date not null,
  priority public.alert_priority not null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

create index idx_health_alerts_farm_open on public.health_alerts (farm_id) where resolved_at is null;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete restrict,
  tag_id text not null,
  breed text not null,
  final_weight numeric(10, 2) not null check (final_weight > 0),
  price_per_kg numeric(12, 2) not null check (price_per_kg >= 0),
  total_revenue numeric(14, 2) generated always as (round((final_weight * price_per_kg), 2)) stored,
  sale_date date not null,
  buyer text not null,
  module_code text not null,
  created_at timestamptz not null default now(),
  unique (animal_id)
);

create index idx_sales_farm_date on public.sales (farm_id, sale_date desc);

create table public.feed_catalog (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms (id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  daily_consumption numeric(10, 3) not null check (daily_consumption >= 0),
  price_per_unit numeric(12, 2) not null check (price_per_unit >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── updated_at en animales ─────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tr_animals_updated_at
before update on public.animals
for each row
execute procedure public.handle_updated_at();

-- ─── RLS (el cliente service_role de Supabase ignora RLS) ───────────────────

alter table public.farms enable row level security;
alter table public.modules enable row level security;
alter table public.animals enable row level security;
alter table public.weight_measurements enable row level security;
alter table public.costs enable row level security;
alter table public.treatments enable row level security;
alter table public.health_alerts enable row level security;
alter table public.sales enable row level security;
alter table public.feed_catalog enable row level security;
