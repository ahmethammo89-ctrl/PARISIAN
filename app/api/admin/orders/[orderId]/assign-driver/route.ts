import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentActor, STAFF_ROLES } from "@/lib/supabase/guards";
import type { DriverTaskType } from "@/types/database";

// Staff assigns (or re-assigns) a driver to an order's pickup or dropoff
// leg. One task per (order, task_type): if one already exists and isn't
// finished, it's re-pointed at the new driver instead of duplicated.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const driverId = body?.driverId as string | undefined;
  const taskType = body?.taskType as DriverTaskType | undefined;
  const scheduledAt = typeof body?.scheduledAt === "string" ? body.scheduledAt : null;
  if (!driverId || !taskType || !["pickup", "dropoff"].includes(taskType)) {
    return NextResponse.json({ error: "driverId_and_taskType_required" }, { status: 400 });
  }

  const { data: driverProfile } = await supabase.from("profiles").select("role").eq("id", driverId).single();
  if (driverProfile?.role !== "driver") {
    return NextResponse.json({ error: "not_a_driver" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("driver_tasks")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("task_type", taskType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status !== "completed") {
    const { error } = await supabase
      .from("driver_tasks")
      .update({ driver_id: driverId, status: "assigned", scheduled_at: scheduledAt })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "assign_failed" }, { status: 500 });
    return NextResponse.json({ taskId: existing.id, reassigned: true });
  }

  const { data: created, error } = await supabase
    .from("driver_tasks")
    .insert({ order_id: orderId, driver_id: driverId, task_type: taskType, scheduled_at: scheduledAt })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "assign_failed" }, { status: 500 });

  return NextResponse.json({ taskId: created.id, reassigned: false });
}
