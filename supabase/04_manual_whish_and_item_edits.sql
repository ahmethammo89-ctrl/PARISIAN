-- =====================================================================
-- PARISIAN LAUNDRY — manual Whish proof-of-payment + wider customer
-- item-edit window. Run once against your existing project (after
-- 01_schema.sql). Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF
-- EXISTS where relevant).
-- =====================================================================

-- Stores the storage path (item-photos bucket, same bucket/RLS pattern
-- as order item photos) of the customer's transfer-confirmation
-- screenshot. provider_reference (already existed) holds the Whish
-- "Transaction ID" the customer types in.
alter table payments add column if not exists proof_photo_url text;

-- Widen the customer's self-edit window on order_items from
-- "pending_confirmation only" to "any pre-pickup status" (also
-- 'confirmed'), matching the product rule: customer can adjust
-- fold/starch/notes per item any time before pickup, locked after.
drop policy if exists order_items_write on order_items;
create policy order_items_write on order_items for all
  using (is_staff() or exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.customer_id = auth.uid()
      and o.status in ('pending_confirmation', 'confirmed')
  ))
  with check (is_staff() or exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.customer_id = auth.uid()
      and o.status in ('pending_confirmation', 'confirmed')
  ));

-- Lets a customer submit their own manual Whish proof-of-payment
-- (status must be 'pending' — only staff can ever mark a payment
-- 'paid', via payments_staff_write below).
drop policy if exists payments_owner_insert_pending on payments;
create policy payments_owner_insert_pending on payments for insert
  with check (
    status = 'pending'
    and provider = 'whish'
    and exists (select 1 from orders o where o.id = payments.order_id and o.customer_id = auth.uid())
  );
