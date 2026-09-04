import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Test-only endpoint: simulates a Whish Money success callback so the
 * order flow is demoable end-to-end before real merchant credentials
 * exist. Only reachable while WHISH_* env vars are unset (mock mode) —
 * refuses to run once real credentials are configured, so it can never
 * be used to fake a real payment.
 */
export async function POST(request: Request) {
  if (process.env.WHISH_API_BASE_URL) {
    return NextResponse.json({ error: "Mock confirmation disabled — live Whish credentials are set" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await request.json();
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("provider", "whish")
    .eq("status", "pending");

  const { error } = await admin.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
