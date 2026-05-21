create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.product_stock_cache (
  cache_key text primary key,
  pincode text not null,
  sku text not null,
  name text not null,
  brand text,
  category text not null,
  product_url text,
  image_url text,
  currency text not null default 'INR',
  price numeric(12, 2),
  in_stock boolean not null default false,
  quantity integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_changed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.product_stock_cache add column if not exists cache_key text;
alter table public.product_stock_cache add column if not exists pincode text default 'global';
alter table public.product_stock_cache add column if not exists sku text;
alter table public.product_stock_cache add column if not exists name text;
alter table public.product_stock_cache add column if not exists brand text;
alter table public.product_stock_cache add column if not exists category text;
alter table public.product_stock_cache add column if not exists product_url text;
alter table public.product_stock_cache add column if not exists image_url text;
alter table public.product_stock_cache add column if not exists currency text default 'INR';
alter table public.product_stock_cache add column if not exists price numeric(12, 2);
alter table public.product_stock_cache add column if not exists in_stock boolean default false;
alter table public.product_stock_cache add column if not exists quantity integer default 0;
alter table public.product_stock_cache add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.product_stock_cache add column if not exists last_seen_at timestamptz default timezone('utc', now());
alter table public.product_stock_cache add column if not exists last_changed_at timestamptz default timezone('utc', now());
alter table public.product_stock_cache add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.product_stock_cache add column if not exists updated_at timestamptz default timezone('utc', now());

update public.product_stock_cache
set
  pincode = coalesce(pincode, 'global'),
  cache_key = coalesce(cache_key, concat_ws(':', coalesce(category, 'uncategorized'), coalesce(pincode, 'global'), sku)),
  currency = coalesce(currency, 'INR'),
  in_stock = coalesce(in_stock, false),
  quantity = coalesce(quantity, 0),
  metadata = coalesce(metadata, '{}'::jsonb),
  last_seen_at = coalesce(last_seen_at, timezone('utc', now())),
  last_changed_at = coalesce(last_changed_at, timezone('utc', now())),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where
  pincode is null
  or cache_key is null
  or currency is null
  or in_stock is null
  or quantity is null
  or metadata is null
  or last_seen_at is null
  or last_changed_at is null
  or created_at is null
  or updated_at is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_stock_cache'::regclass
      and conname = 'product_stock_cache_pkey'
  ) then
    alter table public.product_stock_cache drop constraint product_stock_cache_pkey;
  end if;
end
$$;

alter table public.product_stock_cache alter column cache_key set not null;
alter table public.product_stock_cache alter column pincode set not null;
alter table public.product_stock_cache alter column sku set not null;
alter table public.product_stock_cache alter column name set not null;
alter table public.product_stock_cache alter column category set not null;
alter table public.product_stock_cache alter column currency set not null;
alter table public.product_stock_cache alter column in_stock set not null;
alter table public.product_stock_cache alter column quantity set not null;
alter table public.product_stock_cache alter column metadata set not null;
alter table public.product_stock_cache alter column last_seen_at set not null;
alter table public.product_stock_cache alter column last_changed_at set not null;
alter table public.product_stock_cache alter column created_at set not null;
alter table public.product_stock_cache alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.product_stock_cache'::regclass
      and conname = 'product_stock_cache_pkey'
  ) then
    alter table public.product_stock_cache add constraint product_stock_cache_pkey primary key (cache_key);
  end if;
end
$$;

create unique index if not exists idx_product_stock_cache_cache_key
  on public.product_stock_cache (cache_key);

create table if not exists public.stock_events (
  id uuid primary key default gen_random_uuid(),
  event_hash text,
  run_id uuid not null,
  pincode text,
  sku text not null,
  event_type text not null check (event_type in ('restock', 'out_of_stock', 'low_stock', 'new_product', 'quantity_change', 'price_change')),
  product_name text not null,
  previous_in_stock boolean,
  current_in_stock boolean,
  previous_quantity integer,
  current_quantity integer,
  previous_price numeric(12, 2),
  current_price numeric(12, 2),
  product_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.stock_events add column if not exists event_hash text;
alter table public.stock_events add column if not exists run_id uuid;
alter table public.stock_events add column if not exists pincode text;
alter table public.stock_events add column if not exists sku text;
alter table public.stock_events add column if not exists event_type text;
alter table public.stock_events add column if not exists product_name text;
alter table public.stock_events add column if not exists previous_in_stock boolean;
alter table public.stock_events add column if not exists current_in_stock boolean;
alter table public.stock_events add column if not exists previous_quantity integer;
alter table public.stock_events add column if not exists current_quantity integer;
alter table public.stock_events add column if not exists previous_price numeric(12, 2);
alter table public.stock_events add column if not exists current_price numeric(12, 2);
alter table public.stock_events add column if not exists product_url text;
alter table public.stock_events add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.stock_events add column if not exists created_at timestamptz default timezone('utc', now());

update public.stock_events
set
  event_hash = coalesce(event_hash, gen_random_uuid()::text),
  run_id = coalesce(run_id, gen_random_uuid()),
  sku = coalesce(sku, 'unknown-sku'),
  event_type = coalesce(event_type, 'new_product'),
  product_name = coalesce(product_name, sku, 'Unknown Product'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now()))
where
  event_hash is null
  or
  run_id is null
  or sku is null
  or event_type is null
  or product_name is null
  or metadata is null
  or created_at is null;

alter table public.stock_events alter column event_hash set not null;
alter table public.stock_events alter column run_id set not null;
alter table public.stock_events alter column sku set not null;
alter table public.stock_events alter column event_type set not null;
alter table public.stock_events alter column product_name set not null;
alter table public.stock_events alter column metadata set not null;
alter table public.stock_events alter column created_at set not null;

alter table public.stock_events drop constraint if exists stock_events_event_type_check;
alter table public.stock_events
  add constraint stock_events_event_type_check
  check (event_type in ('restock', 'out_of_stock', 'low_stock', 'new_product', 'quantity_change', 'price_change'));

create table if not exists public.email_commands (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  in_reply_to text,
  sender_email text not null,
  sender_name text,
  subject text,
  command_text text not null,
  command_name text not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'rejected', 'error')),
  response_subject text,
  response_body text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

alter table public.email_commands add column if not exists message_id text;
alter table public.email_commands add column if not exists in_reply_to text;
alter table public.email_commands add column if not exists sender_email text;
alter table public.email_commands add column if not exists sender_name text;
alter table public.email_commands add column if not exists subject text;
alter table public.email_commands add column if not exists command_text text;
alter table public.email_commands add column if not exists command_name text;
alter table public.email_commands add column if not exists parsed_payload jsonb default '{}'::jsonb;
alter table public.email_commands add column if not exists status text default 'received';
alter table public.email_commands add column if not exists response_subject text;
alter table public.email_commands add column if not exists response_body text;
alter table public.email_commands add column if not exists error_message text;
alter table public.email_commands add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.email_commands add column if not exists processed_at timestamptz;

update public.email_commands
set
  message_id = coalesce(message_id, gen_random_uuid()::text),
  sender_email = coalesce(sender_email, 'unknown@example.invalid'),
  command_text = coalesce(command_text, ''),
  command_name = coalesce(command_name, 'UNKNOWN'),
  parsed_payload = coalesce(parsed_payload, '{}'::jsonb),
  status = coalesce(status, 'received'),
  created_at = coalesce(created_at, timezone('utc', now()))
where
  message_id is null
  or sender_email is null
  or command_text is null
  or command_name is null
  or parsed_payload is null
  or status is null
  or created_at is null;

alter table public.email_commands alter column message_id set not null;
alter table public.email_commands alter column sender_email set not null;
alter table public.email_commands alter column command_text set not null;
alter table public.email_commands alter column command_name set not null;
alter table public.email_commands alter column parsed_payload set not null;
alter table public.email_commands alter column status set not null;
alter table public.email_commands alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_commands_message_id_key'
  ) then
    alter table public.email_commands
      add constraint email_commands_message_id_key unique (message_id);
  end if;
end
$$;

create table if not exists public.order_intents (
  id uuid primary key default gen_random_uuid(),
  email_command_id uuid references public.email_commands(id) on delete set null,
  sender_email text not null,
  pincode text,
  sku text not null,
  requested_quantity integer not null check (requested_quantity > 0),
  mode text not null default 'manual_checkout_only' check (mode = 'manual_checkout_only'),
  status text not null default 'pending_manual_checkout' check (status in ('pending_manual_checkout', 'awaiting_stock', 'needs_review', 'completed', 'cancelled')),
  product_name text,
  product_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.order_intents add column if not exists email_command_id uuid;
alter table public.order_intents add column if not exists sender_email text;
alter table public.order_intents add column if not exists pincode text;
alter table public.order_intents add column if not exists sku text;
alter table public.order_intents add column if not exists requested_quantity integer;
alter table public.order_intents add column if not exists mode text default 'manual_checkout_only';
alter table public.order_intents add column if not exists status text default 'pending_manual_checkout';
alter table public.order_intents add column if not exists product_name text;
alter table public.order_intents add column if not exists product_url text;
alter table public.order_intents add column if not exists notes text;
alter table public.order_intents add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.order_intents add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.order_intents add column if not exists updated_at timestamptz default timezone('utc', now());

update public.order_intents
set
  sender_email = coalesce(sender_email, 'unknown@example.invalid'),
  sku = coalesce(sku, 'unknown-sku'),
  requested_quantity = coalesce(requested_quantity, 1),
  mode = coalesce(mode, 'manual_checkout_only'),
  status = coalesce(status, 'pending_manual_checkout'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where
  sender_email is null
  or sku is null
  or requested_quantity is null
  or mode is null
  or status is null
  or metadata is null
  or created_at is null
  or updated_at is null;

alter table public.order_intents alter column sender_email set not null;
alter table public.order_intents alter column sku set not null;
alter table public.order_intents alter column requested_quantity set not null;
alter table public.order_intents alter column mode set not null;
alter table public.order_intents alter column status set not null;
alter table public.order_intents alter column metadata set not null;
alter table public.order_intents alter column created_at set not null;
alter table public.order_intents alter column updated_at set not null;

create index if not exists idx_product_stock_cache_category_stock
  on public.product_stock_cache (category, pincode, in_stock, quantity);

create index if not exists idx_stock_events_run_id
  on public.stock_events (run_id, created_at desc);

create index if not exists idx_email_commands_sender_created
  on public.email_commands (sender_email, created_at desc);

create index if not exists idx_order_intents_sku_status
  on public.order_intents (sku, status, created_at desc);

drop trigger if exists trg_product_stock_cache_updated_at on public.product_stock_cache;
create trigger trg_product_stock_cache_updated_at
before update on public.product_stock_cache
for each row
execute function public.set_updated_at();

drop trigger if exists trg_order_intents_updated_at on public.order_intents;
create trigger trg_order_intents_updated_at
before update on public.order_intents
for each row
execute function public.set_updated_at();
