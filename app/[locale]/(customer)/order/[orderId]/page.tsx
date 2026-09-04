import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LocalizedText } from "@/types/database";
import CustomerOrderDetail from "./CustomerOrderDetail";

// RLS (orders_owner_read) already scopes this to the signed-in
// customer's own orders, but the .eq("customer_id", ...) below keeps
// the intent explicit and gives a clean 404 instead of relying solely
// on the empty-result-from-RLS behavior.
export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).eq("customer_id", user.id).single();
  if (!order) notFound();

  const [{ data: address }, { data: branch }, { data: items }, { data: payments }, { data: messages }] = await Promise.all([
    supabase.from("addresses").select("*").eq("id", order.address_id).single(),
    supabase.from("branches").select("name").eq("id", order.branch_id).single(),
    supabase.from("order_items").select("*").eq("order_id", orderId).order("item_index"),
    supabase.from("payments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at"),
  ]);

  const serviceIds = [...new Set((items ?? []).map((i) => i.service_id))];
  const { data: services } = serviceIds.length
    ? await supabase.from("services").select("id, name, requires_fold_option, requires_starch_option").in("id", serviceIds)
    : { data: [] };
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: photos } = itemIds.length
    ? await supabase.from("order_item_photos").select("*").in("order_item_id", itemIds).order("uploaded_at")
    : { data: [] };

  const paths = (photos ?? []).map((p) => p.photo_url);
  const { data: signed } = paths.length ? await supabase.storage.from("item-photos").createSignedUrls(paths, 3600) : { data: [] };
  const signedMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <CustomerOrderDetail
      order={order}
      address={address ?? null}
      branchName={(branch?.name as LocalizedText) ?? null}
      items={(items ?? []).map((item) => {
        const service = (services ?? []).find((s) => s.id === item.service_id);
        return {
          ...item,
          serviceName: service?.name as LocalizedText | undefined,
          requiresFold: service?.requires_fold_option ?? false,
          requiresStarch: service?.requires_starch_option ?? false,
          photos: (photos ?? [])
            .filter((p) => p.order_item_id === item.id)
            .map((p) => ({ ...p, signedUrl: signedMap.get(p.photo_url) ?? null })),
        };
      })}
      payments={payments ?? []}
      messages={messages ?? []}
      currentUserId={user.id}
    />
  );
}
