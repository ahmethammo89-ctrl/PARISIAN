-- =====================================================================
-- PARISIAN LAUNDRY — general customer <-> staff "Messages / Complaints"
-- inbox (not tied to a single order — one thread per customer, reachable
-- from the customer's home page and from Admin -> Messages), with
-- optional voice notes. Replaces the earlier per-order chat
-- (05_service_images_chat_and_edit_lock.sql) as the customer-facing
-- surface — order_messages/OrderChat are left in place in the schema
-- (harmless, just unused by the UI now) rather than dropped, so this
-- migration is purely additive. Run once against your existing
-- project (after 01-05). Safe to re-run.
-- =====================================================================

-- ---- 1. support_messages: one thread per customer ----
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  sender_id uuid not null references profiles(id),
  sender_role user_role not null,
  body text,
  audio_path text,
  created_at timestamptz not null default now(),
  constraint support_messages_has_content check (body is not null or audio_path is not null)
);

create index if not exists idx_support_messages_customer on support_messages(customer_id, created_at);

alter table support_messages enable row level security;

drop policy if exists support_messages_read on support_messages;
create policy support_messages_read on support_messages for select
  using (customer_id = auth.uid() or is_staff());

drop policy if exists support_messages_insert on support_messages;
create policy support_messages_insert on support_messages for insert
  with check (
    sender_id = auth.uid()
    and (customer_id = auth.uid() or is_staff())
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table support_messages;
  end if;
end $$;

-- ---- 2. Voice notes storage (private, folder-scoped like item-photos) ----
insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', false)
on conflict (id) do nothing;

-- Convention: object path = "{customer_id}/{message_id}.webm"
drop policy if exists storage_chat_audio_read on storage.objects;
create policy storage_chat_audio_read on storage.objects for select
  using (bucket_id = 'chat-audio' and (
    is_staff() or (storage.foldername(name))[1] = auth.uid()::text
  ));

drop policy if exists storage_chat_audio_insert on storage.objects;
create policy storage_chat_audio_insert on storage.objects for insert
  with check (bucket_id = 'chat-audio' and (
    is_staff() or (storage.foldername(name))[1] = auth.uid()::text
  ));
