// Single source of truth for order pricing math. Used for an instant
// client-side preview AND (imported again) for the server-authoritative
// calculation in app/api/orders/route.ts — never trust a price the
// client sends back.

export type PricingLine = { basePrice: number; quantity: number };

export type OrderTotals = {
  subtotal: number;
  scheduleFee: number;
  total: number;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeOrderTotals(
  lines: PricingLine[],
  scheduleMultiplier: number,
  discountAmount = 0
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.basePrice * l.quantity, 0));
  const scheduleFee = round2(subtotal * (scheduleMultiplier - 1));
  const total = round2(Math.max(0, subtotal + scheduleFee - discountAmount));
  return { subtotal, scheduleFee, total };
}
