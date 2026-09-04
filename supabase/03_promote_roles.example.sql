-- =====================================================================
-- Promote a user to staff/admin/driver — run manually in the Supabase
-- SQL editor, per user, AFTER they have signed up once through the app
-- (phone/OTP signup auto-creates their `profiles` row with role
-- 'customer' — see handle_new_auth_user() in 01_schema.sql). There is
-- no self-service way to become staff/driver, by design.
-- =====================================================================

-- 1. Find the user by phone (E.164 format, as stored by Supabase Auth):
-- select id, phone, role from profiles where phone = '+9613703442';

-- 2. Promote them — pick ONE role:
-- update profiles set role = 'admin'   where phone = '+9613703442';
-- update profiles set role = 'staff'   where phone = '+9613703442';
-- update profiles set role = 'driver'  where phone = '+9613703442';

-- 3. (driver only, optional) tie them to a home branch — the branch a
-- driver appears associated with by default; admins can still assign
-- them to pickups/dropoffs at ANY branch from the admin dashboard
-- regardless of this value:
-- update profiles set branch_id = (select id from branches where name->>'en' = 'Clemenceau')
--   where phone = '+9613703442';
