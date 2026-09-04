import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { LocalizedText } from "@/types/database";
import DriverTaskList from "./DriverTaskList";

export default async function DriverDashboard() {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user!.id).single();
  const name = profile?.full_name || profile?.phone || "";

  const { data: tasks } = await supabase
    .from("driver_tasks")
    .select("*")
    .eq("driver_id", user!.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const orderIds = [...new Set((tasks ?? []).map((tk) => tk.order_id))];
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id, order_number, status, branch_id, address_id, customer_id, total_amount, payment_status").in("id", orderIds)
    : { data: [] };

  const addressIds = [...new Set((orders ?? []).map((o) => o.address_id))];
  const branchIds = [...new Set((orders ?? []).map((o) => o.branch_id))];
  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id))];

  const [{ data: addresses }, { data: branches }, { data: customers }] = await Promise.all([
    addressIds.length ? supabase.from("addresses").select("*").in("id", addressIds) : Promise.resolve({ data: [] }),
    branchIds.length ? supabase.from("branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] }),
    customerIds.length ? supabase.from("profiles").select("id, full_name, phone").in("id", customerIds) : Promise.resolve({ data: [] }),
  ]);

  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
  const addressMap = new Map((addresses ?? []).map((a) => [a.id, a]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name as LocalizedText]));
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));

  const enriched = (tasks ?? []).flatMap((tk) => {
    const order = orderMap.get(tk.order_id);
    if (!order) return [];
    return [
      {
        task: tk,
        order,
        address: addressMap.get(order.address_id) ?? null,
        branchName: branchMap.get(order.branch_id) ?? null,
        customer: customerMap.get(order.customer_id) ?? null,
      },
    ];
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading mb-6 text-2xl text-navy-dark">{t("driverWelcome", { name })}</h1>
      <DriverTaskList entries={enriched} />
    </div>
  );
}
