import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/StatusBadge";
import SupportChat from "@/components/SupportChat";
import { formatPrice } from "@/lib/format";

export default async function CustomerDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const ts = await getTranslations("status.order");
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

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount, created_at")
    .eq("customer_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: supportMessages } = await supabase
    .from("support_messages")
    .select("*")
    .eq("customer_id", user!.id)
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl text-navy-dark">{t("customerWelcome", { name })}</h1>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/order/new"
          className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-base hover:bg-navy-dark"
        >
          {t("newOrder")}
        </Link>
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 rounded-full border-2 border-navy px-6 py-3 text-sm font-semibold text-navy-dark hover:bg-sky-pale"
        >
          {t("menuAndPrices")}
        </Link>
      </div>

      <h2 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("myOrders")}</h2>

      {(!orders || orders.length === 0) && <p className="text-sm text-navy-dark/60">{t("noOrders")}</p>}

      <div className="space-y-2">
        {(orders ?? []).map((o) => (
          <Link
            key={o.id}
            href={`/order/${o.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-sky-light bg-base-soft p-4 transition-colors hover:border-sky"
          >
            <div>
              <p className="font-medium text-navy-dark">{o.order_number}</p>
              <p className="mt-0.5 text-xs text-navy/60">{new Date(o.created_at).toLocaleDateString(locale)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy-dark">{formatPrice(o.total_amount, locale)}</span>
              <StatusBadge kind="order" status={o.status} />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <SupportChat customerId={user!.id} currentUserId={user!.id} senderRole="customer" initialMessages={supportMessages ?? []} />
      </div>
    </div>
  );
}
