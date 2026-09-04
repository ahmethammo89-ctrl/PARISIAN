-- =====================================================================
-- PARISIAN LAUNDRY — service photos, per-order chat, realtime new-order
-- alert, and correcting the customer item-edit window. Run once against
-- your existing project (after 01-04). Safe to re-run.
-- =====================================================================

-- ---- 1. Service (catalog item) photos ----
-- One photo per service, shown in Admin -> Catalog and in the
-- customer's service picker. Public bucket (these are marketing/menu
-- images, not private customer photos) — staff-write, anyone-read.
alter table services add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do nothing;

drop policy if exists storage_service_images_read on storage.objects;
create policy storage_service_images_read on storage.objects for select
  using (bucket_id = 'service-images');

drop policy if exists storage_service_images_write on storage.objects;
create policy storage_service_images_write on storage.objects for all
  using (bucket_id = 'service-images' and is_staff())
  with check (bucket_id = 'service-images' and is_staff());

-- ---- 2. Per-order chat (customer <-> staff) ----
create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role user_role not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_messages_order on order_messages(order_id, created_at);

alter table order_messages enable row level security;

drop policy if exists order_messages_read on order_messages;
create policy order_messages_read on order_messages for select
  using (exists (
    select 1 from orders o where o.id = order_messages.order_id
      and (o.customer_id = auth.uid() or is_staff())
  ));

drop policy if exists order_messages_insert on order_messages;
create policy order_messages_insert on order_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from orders o where o.id = order_messages.order_id
        and (o.customer_id = auth.uid() or is_staff())
    )
  );

-- Realtime, for both the chat and the admin new-order alert.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table order_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

-- ---- 3. Correct the customer item-edit window ----
-- 04_manual_whish_and_item_edits.sql widened this to "any pre-pickup
-- status (pending_confirmation OR confirmed)". Product decision: once
-- staff has confirmed the order, the customer can no longer edit it at
-- all (they must contact the branch instead) — so this narrows it back
-- to pending_confirmation only, i.e. before staff approval.
drop policy if exists order_items_write on order_items;
create policy order_items_write on order_items for all
  using (is_staff() or exists (
    select 1 from orders o
    where o.id = order_items.order_id and o.customer_id = auth.uid() and o.status = 'pending_confirmation'
  ))
  with check (is_staff() or exists (
    select 1 from orders o
    where o.id = order_items.order_id and o.customer_id = auth.uid() and o.status = 'pending_confirmation'
  ));
