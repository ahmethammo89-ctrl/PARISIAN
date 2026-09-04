import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LocalizedText } from "@/types/database";
import OrderDetail from "./OrderDetail";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string; locale: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order) notFound();

  const [{ data: customer }, { data: address }, { data: branch }, { data: items }, { data: history }, { data: payments }, { data: tasks }, { data: drivers }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", order.customer_id).single(),
      supabase.from("addresses").select("*").eq("id", order.address_id).single(),
      supabase.from("branches").select("name, phone").eq("id", order.branch_id).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("item_index"),
      supabase.from("order_status_history").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("driver_tasks").select("*").eq("order_id", orderId),
      supabase.from("profiles").select("id, full_name, phone").eq("role", "driver").eq("is_active", true),
    ]);

  const serviceIds = [...new Set((items ?? []).map((i) => i.service_id))];
  const { data: services } = serviceIds.length
    ? await supabase.from("services").select("id, name").in("id", serviceIds)
    : { data: [] };
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: photos } = itemIds.length
    ? await supabase.from("order_item_photos").select("*").in("order_item_id", itemIds).order("uploaded_at")
    : { data: [] };

  // photo_url is a private-bucket storage path, not a fetchable URL —
  // resolve one signed URL per photo (1h) for the admin view.
  const paths = (photos ?? []).map((p) => p.photo_url);
  const { data: signed } = paths.length
    ? await supabase.storage.from("item-photos").createSignedUrls(paths, 3600)
    : { data: [] };
  const signedMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  // Same for any manual Whish proof-of-payment screenshots.
  const proofPaths = (payments ?? []).map((p) => p.proof_photo_url).filter((p): p is string => !!p);
  const { data: signedProofs } = proofPaths.length
    ? await supabase.storage.from("item-photos").createSignedUrls(proofPaths, 3600)
    : { data: [] };
  const signedProofMap = new Map((signedProofs ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <OrderDetail
      order={order}
      customer={customer ?? null}
      address={address ?? null}
      branchName={(branch?.name as LocalizedText) ?? null}
      branchPhone={branch?.phone ?? null}
      items={(items ?? []).map((item) => ({
        ...item,
        serviceName: (services ?? []).find((s) => s.id === item.service_id)?.name as LocalizedText | undefined,
        photos: (photos ?? [])
          .filter((p) => p.order_item_id === item.id)
          .map((p) => ({ ...p, signedUrl: signedMap.get(p.photo_url) ?? null })),
      }))}
      history={history ?? []}
      payments={(payments ?? []).map((p) => ({
        ...p,
        proofSignedUrl: p.proof_photo_url ? signedProofMap.get(p.proof_photo_url) ?? null : null,
      }))}
      tasks={tasks ?? []}
      drivers={drivers ?? []}
    />
  );
}
