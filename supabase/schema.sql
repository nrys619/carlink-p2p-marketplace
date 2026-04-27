create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key,
  display_name text not null,
  avatar_url text,
  kyc_status text not null default 'pending'
    check (kyc_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  title text not null,
  maker text not null,
  grade text not null,
  year_label text not null,
  mileage integer not null check (mileage >= 0),
  price integer not null check (price > 0),
  location text not null,
  inspection_label text not null,
  tags text[] not null default '{}',
  image_urls text[] not null default '{}',
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'reserved', 'sold', 'archived')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('inspection_certificate', 'transfer_form', 'seal_certificate', 'other')),
  storage_path text not null,
  extracted_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  vehicle_price integer not null,
  platform_fee integer not null,
  title_transfer_fee integer not null,
  status text not null default 'applied'
    check (status in ('applied', 'payment_pending', 'paid', 'handover', 'title_transfer', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists vehicles_search_idx
  on public.vehicles using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(maker, '') || ' ' || coalesce(grade, '') || ' ' || coalesce(location, ''))
  );

create index if not exists vehicles_price_idx on public.vehicles(price);
create index if not exists vehicles_status_idx on public.vehicles(status);
create index if not exists deals_vehicle_idx on public.deals(vehicle_id);
create index if not exists messages_vehicle_idx on public.messages(vehicle_id);
