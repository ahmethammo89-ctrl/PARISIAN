import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import OrderWizard from "./OrderWizard";

export default async function NewOrderPage() {
  const t = await getTranslations("order");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: categories }, { data: services }, { data: schedulePricing }, { data: addresses }, { data: branches }] =
    await Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("schedule_pricing").select("*"),
      supabase.from("addresses").select("*").eq("customer_id", user!.id).order("created_at"),
      supabase.from("branches").select("*").eq("is_active", true),
    ]);

  return (
    <div>
      <div className="border-b border-sky-light px-4 py-5 sm:px-6">
        <h1 className="font-heading text-2xl text-navy-dark">{t("title")}</h1>
      </div>
      <OrderWizard
        categories={categories ?? []}
        services={services ?? []}
        schedulePricing={schedulePricing ?? []}
        addresses={addresses ?? []}
        branches={branches ?? []}
      />
    </div>
  );
}
