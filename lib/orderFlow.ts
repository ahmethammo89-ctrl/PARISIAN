// Shared status state-machines — imported by both admin/driver Route
// Handlers (authoritative validation) and client components (to render
// only the legal next actions). Keeping one source of truth here avoids
// the server and UI ever disagreeing on what transition is allowed.
import type { OrderStatus, ItemStatus, DriverTaskStatus } from "@/types/database";

/** Linear happy-path order of an order. `cancelled` is a side-exit, not a step. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "picked_up",
  "in_processing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
];

export const ITEM_STATUS_FLOW: ItemStatus[] = [
  "registered",
  "tagged",
  "in_processing",
  "cleaned",
  "ready",
  "delivered",
];
const ITEM_SIDE_EXITS: ItemStatus[] = ["lost", "damaged"];

export const DRIVER_TASK_FLOW: DriverTaskStatus[] = ["assigned", "en_route", "completed"];

/** Any forward step (not necessarily +1 — staff can skip stages) or `cancelled`. Never backward. */
export function orderStatusOptions(current: OrderStatus): OrderStatus[] {
  const i = ORDER_STATUS_FLOW.indexOf(current);
  if (i === -1 || current === "delivered") return [];
  const forward = ORDER_STATUS_FLOW.slice(i + 1);
  return [...forward, "cancelled"];
}

export function itemStatusOptions(current: ItemStatus): ItemStatus[] {
  const i = ITEM_STATUS_FLOW.indexOf(current);
  if (i === -1 || current === "delivered") return [...ITEM_SIDE_EXITS];
  return [...ITEM_STATUS_FLOW.slice(i + 1), ...ITEM_SIDE_EXITS];
}

export function driverTaskStatusOptions(current: DriverTaskStatus): DriverTaskStatus[] {
  const i = DRIVER_TASK_FLOW.indexOf(current);
  if (i === -1 || current === "completed") return [];
  return [...DRIVER_TASK_FLOW.slice(i + 1), "failed"];
}

/** True if `target` is strictly ahead of `current` on the happy path (used to avoid a completed driver task regressing an order that staff already advanced further manually). */
export function isOrderStatusAhead(current: OrderStatus, target: OrderStatus): boolean {
  const ci = ORDER_STATUS_FLOW.indexOf(current);
  const ti = ORDER_STATUS_FLOW.indexOf(target);
  return ci !== -1 && ti !== -1 && ti > ci;
}
