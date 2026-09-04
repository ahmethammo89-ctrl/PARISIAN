import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentActor, STAFF_ROLES } from "@/lib/supabase/guards";
import { driverTaskStatusOptions, isOrderStatusAhead } from "@/lib/orderFlow";
import type { DriverTaskStatus, OrderStatus, DriverTaskRow, OrderRow } from "@/types/database";

// Driver's one-click status update. Completing a task nudges the parent
// order forward automatically (pickup done -> order picked_up, dropoff
// done -> order delivered) but only if that's actually ahead of where
// staff already moved the order — never regresses a status staff set
// manually.
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const status = body?.status as DriverTaskStatus | undefined;
  if (!status) return NextResponse.json({ error: "status_required" }, { status: 400 });

  const { data: task } = await supabase
    .from("driver_tasks")
    .select("id, driver_id, order_id, task_type, status")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = task.driver_id === user.id;
  const isStaff = !!role && STAFF_ROLES.includes(role);
  if (!isOwner && !isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const allowed = driverTaskStatusOptions(task.status);
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  const patch: Partial<DriverTaskRow> = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("driver_tasks").update(patch).eq("id", taskId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  if (status === "completed") {
    // Drivers have no RLS write access to `orders`/`order_status_history`
    // (by design — see parisian_laundry_schema.sql) so this system-triggered
    // sync goes through the service-role client, same pattern as payments.
    const target: OrderStatus = task.task_type === "pickup" ? "picked_up" : "delivered";
    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("status").eq("id", task.order_id).single();
    if (order && isOrderStatusAhead(order.status, target)) {
      const orderPatch: Partial<OrderRow> = { status: target };
      if (target === "picked_up") orderPatch.picked_up_at = new Date().toISOString();
      if (target === "delivered") orderPatch.delivered_at = new Date().toISOString();
      await admin.from("orders").update(orderPatch).eq("id", task.order_id);
      await admin.from("order_status_history").insert({ order_id: task.order_id, status: target, changed_by: user.id });
    }
  }

  return NextResponse.json({ status });
}
