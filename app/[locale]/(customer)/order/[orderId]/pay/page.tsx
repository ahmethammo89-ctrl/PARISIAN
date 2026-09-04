import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PayPanel from "./PayPanel";

export default async function OrderPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, payment_status, status")
    .eq("id", orderId)
    .eq("customer_id", user!.id)
    .single();

  if (!order) notFound();

  const { count: itemCount } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  return <PayPanel order={order} itemCount={itemCount ?? 0} />;
}
