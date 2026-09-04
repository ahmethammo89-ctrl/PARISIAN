import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";

export default async function CustomerDashboard() {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user!.id)
    .single();

  const name = profile?.full_name || profile?.phone || "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl text-navy-dark">{t("customerWelcome", { name })}</h1>
      <Link
        href="/order/new"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-base hover:bg-navy-dark"
      >
        {t("newOrder")}
      </Link>
      <p className="mt-4 text-navy-dark/60">{t("comingSoon")}</p>
    </div>
  );
}
