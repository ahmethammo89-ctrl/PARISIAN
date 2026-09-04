import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWhishPaymentLink } from "@/lib/whish";
import type { CreatePaymentBody, CreatePaymentResponse } from "@/types/order";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreatePaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.orderId || (body.method !== "whish" && body.method !== "cash")) {
    return NextResponse.json({ error: "orderId and a valid method are required" }, { status: 400 });
  }

  // Verify the order belongs to this user and is still payable — using
  // the user-scoped client (RLS-checked), not the admin client, for
  // this read.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, payment_status")
    .eq("id", body.orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "Order is already paid" }, { status: 409 });
  }

  // Payments are staff-write-only under RLS by design (see
  // parisian_laundry_schema.sql) — this Route Handler is the trusted
  // system path allowed to create one, and only after the ownership
  // check above.
  const admin = createAdminClient();

  if (body.method === "cash") {
    const { error } = await admin.from("payments").insert({
      order_id: order.id,
      provider: "cash",
      amount: order.total_amount,
      status: "pending",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const response: CreatePaymentResponse = { paymentUrl: null, mocked: false, method: "cash" };
    return NextResponse.json(response);
  }

  const origin = new URL(request.url).origin;
  const link = await createWhishPaymentLink({
    orderId: order.id,
    orderNumber: order.order_number,
    amount: order.total_amount,
    successUrl: `${origin}/api/payments/whish/callback?order=${order.id}&status=success`,
    cancelUrl: `${origin}/api/payments/whish/callback?order=${order.id}&status=cancelled`,
  });

  const { error } = await admin.from("payments").insert({
    order_id: order.id,
    provider: "whish",
    amount: order.total_amount,
    status: "pending",
    payment_link: link.paymentUrl,
    provider_reference: link.providerReference,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response: CreatePaymentResponse = {
    paymentUrl: link.paymentUrl,
    mocked: link.mocked,
    method: "whish",
  };
  return NextResponse.json(response);
}
