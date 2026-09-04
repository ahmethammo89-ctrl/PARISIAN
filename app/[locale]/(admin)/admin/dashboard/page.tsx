import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import type { OrderStatus } from "@/types/database";

const WATCH_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "picked_up",
  "in_processing",
  "ready_for_delivery",
  "out_for_delivery",
];

export default async function AdminDashboard() {
  const t = await getTranslations("dashboard");
  const ts = await getTranslations("status.order");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, role").eq("id", user!.id).single();
  const name = profile?.full_name || profile?.phone || "";

  const counts = await Promise.all(
    WATCH_STATUSES.map(async (status) => {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", status);
      return { status, count: count ?? 0 };
    })
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-heading text-2xl text-navy-dark sm:text-3xl">{t("adminWelcome", { name })}</h1>
      <p className="mt-1 text-sm uppercase tracking-wide text-navy">{profile?.role}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map(({ status, count }) => (
          <Link
            key={status}
            href={{ pathname: "/admin/orders", query: { status } }}
            className="rounded-2xl border border-sky-light bg-base-soft p-4 transition-colors hover:border-sky"
          >
            <p className="font-heading text-3xl text-navy-dark">{count}</p>
            <p className="mt-1 text-xs text-navy/70">{ts(status)}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/orders" className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark">
          {t("viewAllOrders")}
        </Link>
        <Link
          href="/admin/scan"
          className="rounded-full border-2 border-navy px-5 py-2.5 text-sm font-semibold text-navy-dark hover:bg-sky-pale"
        >
          {t("scanItem")}
        </Link>
      </div>
    </div>
  );
}
