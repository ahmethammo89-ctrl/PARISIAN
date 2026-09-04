import type { FoldType, StarchLevel, ScheduleType } from "./database";

export type CreateOrderLine = {
  serviceId: string;
  quantity: number;
  foldType: FoldType | null;
  starchLevel: StarchLevel | null;
  /** Per-instance stain notes, index-aligned to item 1..quantity. */
  itemNotes?: (string | null)[];
};

export type CreateOrderBody = {
  addressId: string;
  branchId: string;
  scheduleType: ScheduleType;
  customerNotes?: string;
  lines: CreateOrderLine[];
};

export type CreatedOrderItem = {
  id: string;
  service_id: string;
  item_index: number;
  barcode: string;
};

export type CreateOrderResponse = {
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    schedule_fee: number;
    total_amount: number;
    status: string;
  };
  items: CreatedOrderItem[];
};

export type CreatePaymentBody = {
  orderId: string;
  method: "whish" | "cash";
};

export type CreatePaymentResponse = {
  paymentUrl: string | null;
  mocked: boolean;
  method: "whish" | "cash";
};
