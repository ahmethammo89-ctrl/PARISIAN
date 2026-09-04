// Hand-written types mirroring parisian_laundry_schema.sql (Step 1).
// Swap for `supabase gen types typescript` output once the project is
// linked to a live Supabase instance — shape is compatible.

export type UserRole = "customer" | "driver" | "staff" | "admin" | "super_admin";
export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "picked_up"
  | "in_processing"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type ScheduleType = "normal" | "express" | "urgent";
export type FoldType = "folded" | "hanger";
export type StarchLevel = "none" | "light" | "medium" | "heavy";
export type ItemStatus =
  | "registered"
  | "tagged"
  | "in_processing"
  | "cleaned"
  | "ready"
  | "delivered"
  | "lost"
  | "damaged";
export type PhotoType = "customer_intake" | "staff_intake" | "staff_delivery";
export type PaymentProvider = "whish" | "cash";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type SubscriptionStatus = "active" | "expired" | "cancelled";
export type LoyaltyTxType = "earn" | "redeem" | "adjust";
export type DriverTaskType = "pickup" | "dropoff";
export type DriverTaskStatus = "assigned" | "en_route" | "completed" | "failed";

/** {ar, en, fr} — every customer-facing catalog label. */
export type LocalizedText = { ar: string; en: string; fr: string };

/** Keys whose column type is nullable — always optional on Insert, same as a DB default. */
type NullableKeys<Row> = { [K in keyof Row]: null extends Row[K] ? K : never }[keyof Row];

type Table<Row, InsertOmit extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, InsertOmit | NullableKeys<Row>> & Partial<Pick<Row, InsertOmit | NullableKeys<Row>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  phone: string;
  full_name: string | null;
  role: UserRole;
  preferred_language: "ar" | "en" | "fr";
  avatar_url: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BranchRow = {
  id: string;
  name: LocalizedText;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export type AddressRow = {
  id: string;
  customer_id: string;
  label: string | null;
  address_line: string;
  building: string | null;
  floor: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

export type ServiceCategoryRow = {
  id: string;
  name: LocalizedText;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export type ServiceRow = {
  id: string;
  category_id: string;
  name: LocalizedText;
  description: LocalizedText | null;
  base_price: number;
  requires_fold_option: boolean;
  requires_starch_option: boolean;
  is_haute_couture: boolean;
  is_active: boolean;
  sort_order: number;
}

export type SchedulePricingRow = {
  schedule_type: ScheduleType;
  label: LocalizedText;
  turnaround_hours: number;
  price_multiplier: number;
}

export type VipTierRow = {
  id: string;
  name: LocalizedText;
  monthly_price: number;
  cashback_percent: number;
  perks: Record<string, unknown> | null;
  is_active: boolean;
}

export type SubscriptionRow = {
  id: string;
  customer_id: string;
  tier_id: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  created_at: string;
}

export type LoyaltyWalletRow = {
  customer_id: string;
  points_balance: number;
  cashback_balance: number;
  updated_at: string;
}

export type LoyaltyTransactionRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  tx_type: LoyaltyTxType;
  points: number;
  cashback_amount: number;
  note: string | null;
  created_at: string;
}

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  branch_id: string;
  address_id: string;
  schedule_type: ScheduleType;
  status: OrderStatus;
  subtotal: number;
  schedule_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  pickup_scheduled_at: string | null;
  delivery_scheduled_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderItemRow = {
  id: string;
  order_id: string;
  service_id: string;
  item_index: number;
  fold_type: FoldType | null;
  starch_level: StarchLevel | null;
  stain_notes: string | null;
  unit_price: number;
  status: ItemStatus;
  barcode: string;
  created_at: string;
  updated_at: string;
}

export type OrderItemPhotoRow = {
  id: string;
  order_item_id: string;
  photo_url: string;
  photo_type: PhotoType;
  uploaded_by: string | null;
  uploaded_at: string;
}

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export type PaymentRow = {
  id: string;
  order_id: string;
  provider: PaymentProvider;
  amount: number;
  status: PaymentStatus;
  payment_link: string | null;
  provider_reference: string | null;
  proof_photo_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export type DriverTaskRow = {
  id: string;
  order_id: string;
  driver_id: string;
  task_type: DriverTaskType;
  status: DriverTaskStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "role" | "preferred_language" | "is_active" | "created_at" | "updated_at">;
      branches: Table<BranchRow, "id" | "is_active" | "created_at">;
      addresses: Table<AddressRow, "id" | "is_default" | "created_at">;
      service_categories: Table<ServiceCategoryRow, "id" | "sort_order" | "is_active">;
      services: Table<
        ServiceRow,
        "id" | "requires_fold_option" | "requires_starch_option" | "is_haute_couture" | "is_active" | "sort_order"
      >;
      schedule_pricing: Table<SchedulePricingRow>;
      vip_tiers: Table<VipTierRow, "id" | "is_active">;
      subscriptions: Table<SubscriptionRow, "id" | "status" | "started_at" | "auto_renew" | "created_at">;
      loyalty_wallets: Table<LoyaltyWalletRow, "points_balance" | "cashback_balance" | "updated_at">;
      loyalty_transactions: Table<LoyaltyTransactionRow, "id" | "points" | "cashback_amount" | "created_at">;
      orders: Table<
        OrderRow,
        | "id"
        | "order_number"
        | "status"
        | "subtotal"
        | "schedule_fee"
        | "discount_amount"
        | "total_amount"
        | "payment_status"
        | "created_at"
        | "updated_at"
      >;
      order_items: Table<OrderItemRow, "id" | "status" | "barcode" | "created_at" | "updated_at">;
      order_item_photos: Table<OrderItemPhotoRow, "id" | "photo_type" | "uploaded_at">;
      order_status_history: Table<OrderStatusHistoryRow, "id" | "created_at">;
      payments: Table<PaymentRow, "id" | "status" | "created_at">;
      driver_tasks: Table<DriverTaskRow, "id" | "status" | "created_at">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      schedule_type: ScheduleType;
      fold_type: FoldType;
      starch_level: StarchLevel;
      item_status: ItemStatus;
      photo_type: PhotoType;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
      subscription_status: SubscriptionStatus;
      loyalty_tx_type: LoyaltyTxType;
      driver_task_type: DriverTaskType;
      driver_task_status: DriverTaskStatus;
    };
  };
}
