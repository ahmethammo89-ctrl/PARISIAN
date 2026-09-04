-- =====================================================================
-- PARISIAN LAUNDRY — Starter catalog seed (Step 3 addition)
-- Run once, after parisian_laundry_schema.sql. Populates the 5 service
-- categories you confirmed (Clothes, Upholstery, Shoes, Bags, Haute
-- Couture) with a starting set of services so the customer app has
-- something to order. Prices are placeholders in USD — edit freely
-- from the admin dashboard once Step 4 ships, or directly in SQL now.
-- =====================================================================

with cats as (
  insert into service_categories (name, icon, sort_order) values
    ('{"ar":"ملابس","en":"Clothes","fr":"Vêtements"}', 'shirt', 1),
    ('{"ar":"مفروشات","en":"Upholstery","fr":"Ameublement"}', 'sofa', 2),
    ('{"ar":"أحذية","en":"Shoes","fr":"Chaussures"}', 'shoe', 3),
    ('{"ar":"حقائب","en":"Bags","fr":"Sacs"}', 'bag', 4),
    ('{"ar":"عناية فاخرة","en":"Haute Couture","fr":"Haute Couture"}', 'sparkle', 5)
  returning id, name->>'en' as name_en
)
insert into services (category_id, name, description, base_price, requires_fold_option, requires_starch_option, is_haute_couture, sort_order)
select c.id, v.name, v.description, v.base_price, v.requires_fold, v.requires_starch, v.haute, v.sort_order
from cats c
join (values
  -- Clothes
  ('Clothes', '{"ar":"قميص","en":"Shirt","fr":"Chemise"}'::jsonb, null::jsonb, 3.50, true, true, false, 1),
  ('Clothes', '{"ar":"بنطلون","en":"Trousers","fr":"Pantalon"}'::jsonb, null::jsonb, 4.00, true, true, false, 2),
  ('Clothes', '{"ar":"بدلة رجالية (قطعتين)","en":"Suit (2-piece)","fr":"Costume (2 pièces)"}'::jsonb, null::jsonb, 12.00, true, false, false, 3),
  ('Clothes', '{"ar":"فستان","en":"Dress","fr":"Robe"}'::jsonb, null::jsonb, 8.00, true, false, false, 4),
  ('Clothes', '{"ar":"عباية","en":"Abaya","fr":"Abaya"}'::jsonb, null::jsonb, 9.00, true, false, false, 5),
  ('Clothes', '{"ar":"جاكيت / معطف","en":"Jacket / Coat","fr":"Veste / Manteau"}'::jsonb, null::jsonb, 7.00, true, false, false, 6),
  -- Upholstery
  ('Upholstery', '{"ar":"مقعد كنبة (للمقعد الواحد)","en":"Sofa seat (per seat)","fr":"Fauteuil de canapé (par place)"}'::jsonb, null::jsonb, 15.00, false, false, false, 1),
  ('Upholstery', '{"ar":"ستارة (للقطعة)","en":"Curtain (per panel)","fr":"Rideau (par panneau)"}'::jsonb, null::jsonb, 10.00, false, false, false, 2),
  ('Upholstery', '{"ar":"سجادة (للمتر المربع)","en":"Carpet (per m²)","fr":"Tapis (par m²)"}'::jsonb, null::jsonb, 6.00, false, false, false, 3),
  -- Shoes
  ('Shoes', '{"ar":"حذاء جلد","en":"Leather shoes","fr":"Chaussures en cuir"}'::jsonb, null::jsonb, 10.00, false, false, false, 1),
  ('Shoes', '{"ar":"حذاء رياضي","en":"Sneakers","fr":"Baskets"}'::jsonb, null::jsonb, 8.00, false, false, false, 2),
  -- Bags
  ('Bags', '{"ar":"حقيبة يد","en":"Handbag","fr":"Sac à main"}'::jsonb, null::jsonb, 12.00, false, false, false, 1),
  ('Bags', '{"ar":"حقيبة جلدية (تنظيف عميق)","en":"Leather bag (deep clean)","fr":"Sac en cuir (nettoyage en profondeur)"}'::jsonb, null::jsonb, 18.00, false, false, false, 2),
  -- Haute Couture
  ('Haute Couture', '{"ar":"فستان زفاف","en":"Wedding dress","fr":"Robe de mariée"}'::jsonb, '{"ar":"عناية يدوية متخصصة","en":"Specialist hand finishing","fr":"Finition artisanale spécialisée"}'::jsonb, 45.00, true, false, true, 1),
  ('Haute Couture', '{"ar":"فستان سهرة","en":"Evening gown","fr":"Robe de soirée"}'::jsonb, null::jsonb, 30.00, true, false, true, 2),
  ('Haute Couture', '{"ar":"بدلة ماركة","en":"Designer suit","fr":"Costume de créateur"}'::jsonb, null::jsonb, 25.00, true, false, true, 3)
) as v(cat_name, name, description, base_price, requires_fold, requires_starch, haute, sort_order)
  on v.cat_name = c.name_en;
