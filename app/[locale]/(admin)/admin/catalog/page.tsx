import { createClient } from "@/lib/supabase/server";
import CatalogClient from "./CatalogClient";

// No extra role gate needed here — the (admin) layout already restricts
// this whole section to staff/admin/super_admin, and that's exactly who
// RLS (`services_admin_write` / `categories_admin_write`, both
// `using (is_staff())`) already allows to write categories/services.
export default async function CatalogPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase.from("service_categories").select("id, name, icon, sort_order, is_active").order("sort_order", { ascending: true }),
    supabase
      .from("services")
      .select(
        "id, category_id, name, description, base_price, requires_fold_option, requires_starch_option, is_haute_couture, is_active, sort_order, image_url"
      )
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <CatalogClient initialCategories={categories ?? []} initialServices={services ?? []} />
    </div>
  );
}
