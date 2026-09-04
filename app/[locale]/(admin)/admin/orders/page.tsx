import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import type { OrderStatus, LocalizedText } from "@/types/database";
import OrderFilters from "./OrderFilters";
import StatusBadge from "@/components/StatusBadge";

const ORDER_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "picked_up",
  "in_processing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; branch?: string; q?: string }>;
}) {
  const { locale } = await params;
  const { status, branch, q } = await searchParams;
  const t = await getTranslations("admin.orders");
  const supabase = await createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").order("created_at");

  let query = supabase
    .from("orders")
    .select("id, order_number, status, total_amount, payment_status, schedule_type, branch_id, customer_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status as OrderStatus);
  if (branch) query = query.eq("branch_id", branch);

  if (q) {
    const { data: matchingProfiles } = await supabase.from("profiles").select("id").ilike("phone", `%${q}%`).limit(20);
    const ids = (matchingProfiles ?? []).map((p) => p.id);
    const idsClause = ids.length ? `,customer_id.in.(${ids.join(",")})` : "";
    query = query.or(`order_number.ilike.%${q}%${idsClause}`);
  }

  const { data: orders } = await query;

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id))];
  const { data: customers } = customerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
    : { data: [] };
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name as LocalizedText]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl text-navy-dark">{t("title")}</h1>

      <OrderFilters branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name as LocalizedText }))} statuses={ORDER_STATUSES} />

      <div className="mt-6 space-y-2">
        {(orders ?? []).length === 0 && <p className="py-12 text-center text-sm text-navy/60">{t("empty")}</p>}
        {(orders ?? []).map((order) => {
          const customer = customerMap.get(order.customer_id);
          const branchName = branchMap.get(order.branch_id);
          return (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-sky-light bg-base-soft px-4 py-3.5 transition-colors hover:border-sky"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy-dark">{order.order_number}</span>
                  <StatusBadge kind="order" status={order.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-navy/70">
                  {customer?.full_name || customer?.phone} · {branchName?.[locale as "ar" | "en" | "fr"] ?? branchName?.en}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="font-semibold text-navy-dark">{formatPrice(order.total_amount, locale)}</p>
                <p className="text-xs text-navy/60">{order.payment_status}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
