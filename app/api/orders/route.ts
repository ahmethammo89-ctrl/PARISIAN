import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, type PricingLine } from "@/lib/pricing";
import type { CreateOrderBody, CreateOrderResponse } from "@/types/order";
import type { FoldType, StarchLevel, ScheduleType } from "@/types/database";

const SCHEDULE_TYPES: ScheduleType[] = ["normal", "express", "urgent"];
const FOLD_TYPES: FoldType[] = ["folded", "hanger"];
const STARCH_LEVELS: StarchLevel[] = ["none", "light", "medium", "heavy"];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body.addressId || !body.branchId) {
    return badRequest("addressId and branchId are required");
  }
  if (!SCHEDULE_TYPES.includes(body.scheduleType)) {
    return badRequest("Invalid scheduleType");
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return badRequest("At least one order line is required");
  }
  for (const line of body.lines) {
    if (!line.serviceId) return badRequest("Each line needs a serviceId");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      return badRequest("quantity must be an integer between 1 and 20");
    }
    if (line.foldType !== null && !FOLD_TYPES.includes(line.foldType)) {
      return badRequest("Invalid foldType");
    }
    if (line.starchLevel !== null && !STARCH_LEVELS.includes(line.starchLevel)) {
      return badRequest("Invalid starchLevel");
    }
  }

  // Ownership checks — the address must belong to this customer.
  const { data: address } = await supabase
    .from("addresses")
    .select("id")
    .eq("id", body.addressId)
    .eq("customer_id", user.id)
    .single();
  if (!address) return badRequest("Address not found");

  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("id", body.branchId)
    .eq("is_active", true)
    .single();
  if (!branch) return badRequest("Branch not found");

  const { data: schedulePricing } = await supabase
    .from("schedule_pricing")
    .select("schedule_type, price_multiplier")
    .eq("schedule_type", body.scheduleType)
    .single();
  if (!schedulePricing) return badRequest("Schedule pricing not configured");

  const serviceIds = [...new Set(body.lines.map((l) => l.serviceId))];
  const { data: services } = await supabase
    .from("services")
    .select("id, base_price, is_active, requires_fold_option, requires_starch_option")
    .in("id", serviceIds);

  const serviceMap = new Map((services ?? []).map((s) => [s.id, s]));
  for (const line of body.lines) {
    const service = serviceMap.get(line.serviceId);
    if (!service || !service.is_active) return badRequest(`Service ${line.serviceId} is not available`);
    if (service.requires_fold_option && !line.foldType) {
      return badRequest(`Service ${line.serviceId} requires a fold type`);
    }
    if (service.requires_starch_option && !line.starchLevel) {
      return badRequest(`Service ${line.serviceId} requires a starch level`);
    }
  }

  // Server-authoritative pricing — never trust a client-sent total.
  const pricingLines: PricingLine[] = body.lines.map((l) => ({
    basePrice: serviceMap.get(l.serviceId)!.base_price,
    quantity: l.quantity,
  }));
  const totals = computeOrderTotals(pricingLines, schedulePricing.price_multiplier);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      branch_id: body.branchId,
      address_id: body.addressId,
      schedule_type: body.scheduleType,
      subtotal: totals.subtotal,
      schedule_fee: totals.scheduleFee,
      total_amount: totals.total,
      customer_notes: body.customerNotes || null,
    })
    .select("id, order_number, subtotal, schedule_fee, total_amount, status")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create order" }, { status: 500 });
  }

  const itemRows = body.lines.flatMap((line) => {
    const service = serviceMap.get(line.serviceId)!;
    return Array.from({ length: line.quantity }, (_, i) => ({
      order_id: order.id,
      service_id: line.serviceId,
      item_index: i + 1,
      fold_type: line.foldType,
      starch_level: line.starchLevel,
      stain_notes: line.itemNotes?.[i] || null,
      unit_price: service.base_price,
    }));
  });

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows)
    .select("id, service_id, item_index, barcode");

  if (itemsError || !items) {
    return NextResponse.json(
      { error: itemsError?.message ?? "Order created but items failed — contact support with order " + order.order_number },
      { status: 500 }
    );
  }

  const response: CreateOrderResponse = { order, items };
  return NextResponse.json(response, { status: 201 });
}
