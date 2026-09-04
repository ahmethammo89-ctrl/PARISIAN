-- =====================================================================
-- PARISIAN LAUNDRY (المصبغة الباريسية) — Supabase Schema (Step 1)
-- Postgres 15+ / Supabase. Run in SQL editor, top to bottom.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

create type user_role as enum ('customer','driver','staff','admin','super_admin');
create type order_status as enum (
  'pending_confirmation','confirmed','picked_up','in_processing',
  'ready_for_delivery','out_for_delivery','delivered','cancelled'
);
create type schedule_type as enum ('normal','express','urgent');
create type fold_type as enum ('folded','hanger');
create type starch_level as enum ('none','light','medium','heavy');
create type item_status as enum (
  'registered','tagged','in_processing','cleaned','ready','delivered','lost','damaged'
);
create type photo_type as enum ('customer_intake','staff_intake','staff_delivery');
create type payment_provider as enum ('whish','cash');
create type payment_status as enum ('pending','paid','failed','refunded');
create type subscription_status as enum ('active','expired','cancelled');
create type loyalty_tx_type as enum ('earn','redeem','adjust');
create type driver_task_type as enum ('pickup','dropoff');
create type driver_task_status as enum ('assigned','en_route','completed','failed');

-- =====================================================================
-- 2. HELPERS
-- =====================================================================

-- generic updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 3. PROFILES (extends auth.users)
-- =====================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  full_name text,
  role user_role not null default 'customer',
  preferred_language text not null default 'ar' check (preferred_language in ('ar','en','fr')),
  avatar_url text,
  branch_id uuid, -- for staff/driver: home branch (FK added after branches table)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- auto-create profile row when a phone/OTP user signs up in auth.users
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, phone, role)
  values (new.id, coalesce(new.phone, new.email, new.id::text), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- current caller's role, SECURITY DEFINER so RLS on profiles can't
-- self-reference and recurse
create or replace function auth_role()
returns user_role language sql stable security definer
set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_staff()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid())
    in ('staff','admin','super_admin'), false);
$$;

create or replace function is_driver()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'driver', false);
$$;

-- =====================================================================
-- 4. BRANCHES
-- =====================================================================

create table branches (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null, -- {"ar":"...","en":"...","fr":"..."}
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint fk_profiles_branch foreign key (branch_id) references branches(id);

-- seed: the two known branches
insert into branches (name, address, phone) values
  ('{"ar":"الساقية الجنزير","en":"Sakiet Al-Janzir","fr":"Sakiet Al-Janzir"}', 'Sakiet Al-Janzir', '03 703442'),
  ('{"ar":"كليمنصو","en":"Clemenceau","fr":"Clemenceau"}', 'Clemenceau', '71 226 865');

-- =====================================================================
-- 5. CUSTOMER ADDRESSES
-- =====================================================================

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  label text, -- "Home","Office",...
  address_line text not null,
  building text,
  floor text,
  city text,
  lat numeric(9,6),
  lng numeric(9,6),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_addresses_customer on addresses(customer_id);

-- =====================================================================
-- 6. SERVICE CATALOG (menu)
-- =====================================================================

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,          -- {"ar":..,"en":..,"fr":..}
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references service_categories(id) on delete restrict,
  name jsonb not null,
  description jsonb,
  base_price numeric(10,2) not null check (base_price >= 0),
  requires_fold_option boolean not null default true,
  requires_starch_option boolean not null default true,
  is_haute_couture boolean not null default false, -- flags designer/couture care (manual quote allowed)
  is_active boolean not null default true,
  sort_order int not null default 0
);

create index idx_services_category on services(category_id);

-- normal/express/urgent multipliers + turnaround, editable by admin
create table schedule_pricing (
  schedule_type schedule_type primary key,
  label jsonb not null,
  turnaround_hours int not null,
  price_multiplier numeric(4,2) not null -- e.g. 1.00 / 1.10 / 1.50
);

insert into schedule_pricing (schedule_type, label, turnaround_hours, price_multiplier) values
  ('normal',  '{"ar":"عادي","en":"Normal","fr":"Normal"}', 48, 1.00),
  ('express', '{"ar":"سريع","en":"Express","fr":"Express"}', 24, 1.10),
  ('urgent',  '{"ar":"مستعجل","en":"Urgent","fr":"Urgent"}', 2, 1.50);

-- =====================================================================
-- 7. VIP SUBSCRIPTIONS & LOYALTY
-- =====================================================================

create table vip_tiers (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,
  monthly_price numeric(10,2) not null,
  cashback_percent numeric(5,2) not null default 0,
  perks jsonb,
  is_active boolean not null default true
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  tier_id uuid not null references vip_tiers(id),
  status subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_subscriptions_customer on subscriptions(customer_id);

create table loyalty_wallets (
  customer_id uuid primary key references profiles(id) on delete cascade,
  points_balance int not null default 0,
  cashback_balance numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  order_id uuid, -- FK added after orders table
  tx_type loyalty_tx_type not null,
  points int not null default 0,
  cashback_amount numeric(10,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index idx_loyalty_tx_customer on loyalty_transactions(customer_id);

-- =====================================================================
-- 8. ORDERS
-- =====================================================================

create sequence order_number_seq;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PL-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('order_number_seq')::text,5,'0')),
  customer_id uuid not null references profiles(id),
  branch_id uuid not null references branches(id),
  address_id uuid not null references addresses(id),
  schedule_type schedule_type not null default 'normal',
  status order_status not null default 'pending_confirmation',
  subtotal numeric(10,2) not null default 0,
  schedule_fee numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  payment_status payment_status not null default 'pending',
  pickup_scheduled_at timestamptz,
  delivery_scheduled_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table loyalty_transactions
  add constraint fk_loyalty_order foreign key (order_id) references orders(id);

create index idx_orders_customer on orders(customer_id);
create index idx_orders_branch on orders(branch_id);
create index idx_orders_status on orders(status);

create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

-- =====================================================================
-- 9. ORDER ITEMS (one row = one physical item instance)
-- =====================================================================

create sequence item_barcode_seq;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid not null references services(id),
  item_index int not null,           -- 1..N within this service line, for UI "Item 2 of 3"
  fold_type fold_type,
  starch_level starch_level,
  stain_notes text,
  unit_price numeric(10,2) not null,
  status item_status not null default 'registered',
  barcode text not null unique default ('PLI-' || lpad(nextval('item_barcode_seq')::text,8,'0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, service_id, item_index)
);

create index idx_order_items_order on order_items(order_id);
create index idx_order_items_status on order_items(status);

create trigger trg_order_items_updated before update on order_items
  for each row execute function set_updated_at();

-- per-item photo tracking (each item instance gets its own upload slots)
create table order_item_photos (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  photo_url text not null,        -- Supabase Storage path
  photo_type photo_type not null default 'customer_intake',
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create index idx_item_photos_item on order_item_photos(order_item_id);

-- full audit trail of status changes
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index idx_status_history_order on order_status_history(order_id);

-- =====================================================================
-- 10. PAYMENTS (Whish Money etc.)
-- =====================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider payment_provider not null default 'whish',
  amount numeric(10,2) not null,
  status payment_status not null default 'pending',
  payment_link text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_payments_order on payments(order_id);

-- =====================================================================
-- 11. DRIVER TASKS
-- =====================================================================

create table driver_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  driver_id uuid not null references profiles(id),
  task_type driver_task_type not null,
  status driver_task_status not null default 'assigned',
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_driver_tasks_driver on driver_tasks(driver_id);
create index idx_driver_tasks_order on driver_tasks(order_id);

-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================

alter table profiles enable row level security;
alter table branches enable row level security;
alter table addresses enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table schedule_pricing enable row level security;
alter table vip_tiers enable row level security;
alter table subscriptions enable row level security;
alter table loyalty_wallets enable row level security;
alter table loyalty_transactions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_photos enable row level security;
alter table order_status_history enable row level security;
alter table payments enable row level security;
alter table driver_tasks enable row level security;

-- ---- profiles ----
create policy profiles_select_own on profiles for select
  using (id = auth.uid() or is_staff());
create policy profiles_update_own on profiles for update
  using (id = auth.uid() or is_staff());

-- ---- branches / catalog: public read, admin write ----
create policy branches_public_read on branches for select using (true);
create policy branches_admin_write on branches for all using (is_staff()) with check (is_staff());

create policy categories_public_read on service_categories for select using (true);
create policy categories_admin_write on service_categories for all using (is_staff()) with check (is_staff());

create policy services_public_read on services for select using (true);
create policy services_admin_write on services for all using (is_staff()) with check (is_staff());

create policy pricing_public_read on schedule_pricing for select using (true);
create policy pricing_admin_write on schedule_pricing for all using (is_staff()) with check (is_staff());

create policy tiers_public_read on vip_tiers for select using (true);
create policy tiers_admin_write on vip_tiers for all using (is_staff()) with check (is_staff());

-- ---- addresses: owner CRUD, staff read all ----
create policy addresses_owner_all on addresses for all
  using (customer_id = auth.uid() or is_staff())
  with check (customer_id = auth.uid() or is_staff());

-- ---- subscriptions / loyalty: owner read, staff full ----
create policy subscriptions_owner_read on subscriptions for select
  using (customer_id = auth.uid() or is_staff());
create policy subscriptions_admin_write on subscriptions for insert with check (is_staff());
create policy subscriptions_admin_update on subscriptions for update using (is_staff());

create policy wallet_owner_read on loyalty_wallets for select
  using (customer_id = auth.uid() or is_staff());
create policy wallet_admin_write on loyalty_wallets for all using (is_staff()) with check (is_staff());

create policy loyalty_tx_owner_read on loyalty_transactions for select
  using (customer_id = auth.uid() or is_staff());
create policy loyalty_tx_admin_write on loyalty_transactions for insert with check (is_staff());

-- ---- orders ----
create policy orders_owner_read on orders for select
  using (
    customer_id = auth.uid()
    or is_staff()
    or (is_driver() and exists (
      select 1 from driver_tasks dt where dt.order_id = orders.id and dt.driver_id = auth.uid()
    ))
  );
create policy orders_owner_insert on orders for insert
  with check (customer_id = auth.uid() or is_staff());
create policy orders_update on orders for update
  using (is_staff() or (customer_id = auth.uid() and status = 'pending_confirmation'));

-- ---- order_items: follow parent order visibility ----
create policy order_items_read on order_items for select
  using (exists (
    select 1 from orders o where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or is_staff()
           or (is_driver() and exists (select 1 from driver_tasks dt where dt.order_id = o.id and dt.driver_id = auth.uid())))
  ));
create policy order_items_write on order_items for all
  using (is_staff() or exists (
    select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid() and o.status = 'pending_confirmation'
  ))
  with check (is_staff() or exists (
    select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid() and o.status = 'pending_confirmation'
  ));

-- ---- order_item_photos: customer uploads own item photos, staff full ----
create policy item_photos_read on order_item_photos for select
  using (exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_photos.order_item_id
      and (o.customer_id = auth.uid() or is_staff())
  ));
create policy item_photos_insert on order_item_photos for insert
  with check (
    is_staff()
    or exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.id = order_item_photos.order_item_id and o.customer_id = auth.uid()
    )
  );

-- ---- order_status_history: read if order visible, insert staff only ----
create policy status_history_read on order_status_history for select
  using (exists (
    select 1 from orders o where o.id = order_status_history.order_id
      and (o.customer_id = auth.uid() or is_staff())
  ));
create policy status_history_insert on order_status_history for insert with check (is_staff());

-- ---- payments: owner read, service_role/staff write ----
create policy payments_owner_read on payments for select
  using (exists (select 1 from orders o where o.id = payments.order_id and o.customer_id = auth.uid()) or is_staff());
create policy payments_staff_write on payments for all using (is_staff()) with check (is_staff());

-- ---- driver_tasks: driver sees/updates own, staff full ----
create policy driver_tasks_read on driver_tasks for select
  using (driver_id = auth.uid() or is_staff());
create policy driver_tasks_update on driver_tasks for update
  using (driver_id = auth.uid() or is_staff());
create policy driver_tasks_staff_insert on driver_tasks for insert with check (is_staff());

-- =====================================================================
-- 13. STORAGE (item photos bucket)
-- =====================================================================

insert into storage.buckets (id, name, public) values ('item-photos','item-photos', false)
  on conflict (id) do nothing;

create policy storage_item_photos_read on storage.objects for select
  using (bucket_id = 'item-photos' and (
    is_staff() or (storage.foldername(name))[1] = auth.uid()::text
  ));
create policy storage_item_photos_insert on storage.objects for insert
  with check (bucket_id = 'item-photos' and (
    is_staff() or (storage.foldername(name))[1] = auth.uid()::text
  ));

-- Convention: object path = "{customer_id}/{order_item_id}/{timestamp}.jpg"
