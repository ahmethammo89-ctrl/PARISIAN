import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentActor, STAFF_ROLES } from "@/lib/supabase/guards";
import { orderStatusOptions } from "@/lib/orderFlow";
import type { OrderStatus, OrderRow } from "@/types/database";

// Staff advances an order's status (or cancels it). Validates the
// transition server-side against orderFlow.ts and logs it to
// order_status_history — the UI only ever offers legal next steps, but
// this route is the actual authority, not the button that was clicked.
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status as OrderStatus | undefined;
  const note = typeof body?.note === "string" ? body.note : null;
  if (!status) return NextResponse.json({ error: "status_required" }, { status: 400 });

  const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const allowed = orderStatusOptions(order.status);
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  const patch: Partial<OrderRow> = { status };
  if (status === "picked_up") patch.picked_up_at = new Date().toISOString();
  if (status === "delivered") patch.delivered_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (updateError) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  await supabase.from("order_status_history").insert({ order_id: orderId, status, changed_by: user.id, note });

  return NextResponse.json({ status });
}
