import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentActor, STAFF_ROLES } from "@/lib/supabase/guards";
import { itemStatusOptions } from "@/lib/orderFlow";
import type { ItemStatus } from "@/types/database";

// Staff updates one physical item's status — the core of the anti-loss
// workflow: an item is scanned (by barcode/QR), its status is moved
// along (tagged -> in_processing -> cleaned -> ready -> delivered), or
// flagged lost/damaged with a note staff can see later.
export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status as ItemStatus | undefined;
  if (!status) return NextResponse.json({ error: "status_required" }, { status: 400 });

  const { data: item } = await supabase.from("order_items").select("status").eq("id", itemId).single();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const allowed = itemStatusOptions(item.status);
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  const { error } = await supabase.from("order_items").update({ status }).eq("id", itemId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ status });
}
