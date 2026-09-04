import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentActor, STAFF_ROLES } from "@/lib/supabase/guards";

// Staff reviews a manually-submitted Whish proof-of-payment (screenshot
// + transaction ID) and confirms or rejects it. Regular RLS
// (payments_staff_write / orders_update, both `using (is_staff())`)
// does the actual authorization — this route just gives a clean
// 401/403 instead of a confusing RLS-denied write, same pattern as the
// order/item status routes.
export async function PATCH(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as "confirm" | "reject" | undefined;
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { data: payment } = await supabase.from("payments").select("id, order_id, status").eq("id", paymentId).single();
  if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "confirm") {
    const { error: payErr } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (payErr) return NextResponse.json({ error: "update_failed", detail: payErr.message }, { status: 500 });

    const { error: orderErr } = await supabase.from("orders").update({ payment_status: "paid" }).eq("id", payment.order_id);
    if (orderErr) return NextResponse.json({ error: "update_failed", detail: orderErr.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("payments").update({ status: "failed" }).eq("id", paymentId);
    if (error) return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
