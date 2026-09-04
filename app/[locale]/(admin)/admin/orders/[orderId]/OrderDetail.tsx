"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { formatPrice, isPhoneLike } from "@/lib/format";
import { orderStatusOptions, itemStatusOptions } from "@/lib/orderFlow";
import StatusBadge from "@/components/StatusBadge";
import OrderChat from "@/components/OrderChat";
import type {
  OrderRow,
  AddressRow,
  OrderItemRow,
  OrderItemPhotoRow,
  OrderMessageRow,
  OrderStatusHistoryRow,
  PaymentRow,
  DriverTaskRow,
  LocalizedText,
  OrderStatus,
  ItemStatus,
  DriverTaskType,
  UserRole,
} from "@/types/database";

type ItemWithExtras = OrderItemRow & {
  serviceName?: LocalizedText;
  photos: (OrderItemPhotoRow & { signedUrl: string | null })[];
};

type PaymentWithProof = PaymentRow & { proofSignedUrl: string | null };

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9613703442";

export default function OrderDetail({
  order,
  customer,
  address,
  branchName,
  branchPhone,
  items,
  history,
  payments,
  tasks,
  drivers,
  messages,
  currentUserId,
  currentUserRole,
}: {
  order: OrderRow;
  customer: { full_name: string | null; phone: string } | null;
  address: AddressRow | null;
  branchName: LocalizedText | null;
  branchPhone: string | null;
  items: ItemWithExtras[];
  history: OrderStatusHistoryRow[];
  payments: PaymentWithProof[];
  tasks: DriverTaskRow[];
  drivers: { id: string; full_name: string | null; phone: string }[];
  messages: OrderMessageRow[];
  currentUserId: string;
  currentUserRole: UserRole;
}) {
  const t = useTranslations("admin.orderDetail");
  const ts = useTranslations("status.order");
  const tsItem = useTranslations("status.item");
  const locale = useLocale() as "ar" | "en" | "fr";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateOrderStatus(status: OrderStatus) {
    setBusy(`order:${status}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function updateItemStatus(itemId: string, status: ItemStatus) {
    setBusy(`item:${itemId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function reviewPayment(paymentId: string, action: "confirm" | "reject") {
    setBusy(`payment:${paymentId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function assignDriver(taskType: DriverTaskType, driverId: string) {
    if (!driverId) return;
    setBusy(`assign:${taskType}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/assign-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType, driverId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  const customerHasPhone = isPhoneLike(customer?.phone);
  const whatsappHref = customerHasPhone ? `https://wa.me/${customer!.phone.replace(/[^\d]/g, "")}` : null;
  const pickupTask = tasks.find((t) => t.task_type === "pickup");
  const dropoffTask = tasks.find((t) => t.task_type === "dropoff");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-navy-dark">{order.order_number}</h1>
          <p className="mt-1 text-sm text-navy/70">{new Date(order.created_at).toLocaleString(locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="order" status={order.status} />
          <Link
            href={`/admin/tags/${order.id}`}
            className="rounded-full border border-navy px-3 py-1.5 text-xs font-semibold text-navy-dark hover:bg-sky-pale"
          >
            {t("printTags")}
          </Link>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Customer + address */}
      <section className="mb-5 rounded-2xl border border-sky-light bg-base-soft p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">{t("customer")}</h2>
        <p className="font-medium text-navy-dark">{customer?.full_name || customer?.phone}</p>
        <div className="mt-1 flex gap-3 text-sm">
          {customerHasPhone ? (
            <>
              <a href={`tel:${customer!.phone}`} className="text-navy hover:underline">
                {customer!.phone}
              </a>
              <a href={whatsappHref!} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                WhatsApp
              </a>
            </>
          ) : (
            customer?.phone && <span className="text-navy-dark/60">{customer.phone}</span>
          )}
        </div>
        {address && (
          <p className="mt-2 text-sm text-navy-dark/80">
            {address.address_line}
            {address.building ? `, ${address.building}` : ""}
            {address.floor ? `, ${address.floor}` : ""}
            {address.city ? `, ${address.city}` : ""}
          </p>
        )}
        <p className="mt-2 text-xs text-navy/60">
          {branchName?.[locale] ?? branchName?.en} {branchPhone ? `· ${branchPhone}` : ""}
        </p>
      </section>

      {/* Order status control */}
      <section className="mb-5 rounded-2xl border border-sky-light bg-base-soft p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("orderStatus")}</h2>
        <div className="flex flex-wrap gap-2">
          {orderStatusOptions(order.status).map((s) => (
            <button
              key={s}
              disabled={busy !== null}
              onClick={() => updateOrderStatus(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                s === "cancelled" ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-navy text-base hover:bg-navy-dark"
              }`}
            >
              {busy === `order:${s}` ? t("saving") : `${t("moveTo")} ${ts(s)}`}
            </button>
          ))}
          {orderStatusOptions(order.status).length === 0 && <span className="text-sm text-navy/60">{t("noFurtherActions")}</span>}
        </div>
      </section>

      {/* Driver assignment */}
      <section className="mb-5 rounded-2xl border border-sky-light bg-base-soft p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("driverAssignment")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DriverSlot
            label={t("pickup")}
            task={pickupTask}
            drivers={drivers}
            busy={busy === "assign:pickup"}
            onAssign={(id) => assignDriver("pickup", id)}
          />
          <DriverSlot
            label={t("dropoff")}
            task={dropoffTask}
            drivers={drivers}
            busy={busy === "assign:dropoff"}
            onAssign={(id) => assignDriver("dropoff", id)}
          />
        </div>
      </section>

      {/* Items */}
      <section className="mb-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">
          {t("items")} ({items.length})
        </h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-sky-light bg-base-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-navy-dark">{item.serviceName?.[locale] ?? item.serviceName?.en}</p>
                  <p className="mt-0.5 font-mono text-xs text-navy/60">{item.barcode}</p>
                  {(item.fold_type || item.starch_level || item.stain_notes) && (
                    <p className="mt-1 text-xs text-navy-dark/70">
                      {[item.fold_type, item.starch_level, item.stain_notes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge kind="item" status={item.status} />
                  <Link href={`/admin/scan?code=${item.barcode}`} className="text-[11px] text-navy hover:underline">
                    {t("openInScan")}
                  </Link>
                </div>
              </div>

              {item.photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {item.photos.map(
                    (p) =>
                      p.signedUrl && (
                        <a key={p.id} href={p.signedUrl} target="_blank" rel="noopener noreferrer" className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.signedUrl} alt="" className="h-16 w-16 rounded-lg border border-sky-light object-cover" />
                          {p.photo_type !== "customer_intake" && (
                            <span className="absolute -end-1 -top-1 rounded-full bg-navy px-1.5 py-0.5 text-[8px] font-semibold text-base">
                              {p.photo_type === "staff_intake" ? "S" : "D"}
                            </span>
                          )}
                        </a>
                      )
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {itemStatusOptions(item.status).map((s) => (
                  <button
                    key={s}
                    disabled={busy !== null}
                    onClick={() => updateItemStatus(item.id, s)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                      s === "lost" || s === "damaged"
                        ? "border border-red-300 text-red-700 hover:bg-red-50"
                        : "border border-navy/30 text-navy-dark hover:bg-sky-pale"
                    }`}
                  >
                    {busy === `item:${item.id}` ? t("saving") : tsItem(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payments */}
      <section className="mb-5 rounded-2xl border border-sky-light bg-base-soft p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">{t("payments")}</h2>
        <p className="mb-2 text-sm text-navy-dark">
          {t("total")}: <span className="font-semibold">{formatPrice(order.total_amount, locale)}</span>
        </p>
        {payments.length === 0 && <p className="text-sm text-navy/60">{t("noPayments")}</p>}
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="rounded-xl border border-sky-light/70 bg-white p-3">
              <div className="flex items-center justify-between text-sm text-navy-dark/80">
                <span>
                  {p.provider} · {formatPrice(p.amount, locale)}
                </span>
                <span className="text-xs">{t(`paymentStatus.${p.status}`)}</span>
              </div>

              {p.provider === "whish" && (p.provider_reference || p.proofSignedUrl) && (
                <div className="mt-2 space-y-2">
                  {p.provider_reference && (
                    <p className="text-xs text-navy-dark/70">
                      {t("transactionId")}: <span className="font-mono">{p.provider_reference}</span>
                    </p>
                  )}
                  {p.proofSignedUrl && (
                    <a href={p.proofSignedUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.proofSignedUrl} alt="" className="h-32 w-full max-w-xs rounded-lg border border-sky-light object-cover" />
                    </a>
                  )}
                  {p.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => reviewPayment(p.id, "confirm")}
                        className="rounded-full bg-navy px-3.5 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
                      >
                        {busy === `payment:${p.id}` ? t("saving") : t("confirmPayment")}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => reviewPayment(p.id, "reject")}
                        className="rounded-full border border-red-300 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {t("rejectPayment")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Chat */}
      <div className="mb-5">
        <OrderChat orderId={order.id} currentUserId={currentUserId} senderRole={currentUserRole} initialMessages={messages} />
      </div>

      {/* History */}
      <section className="rounded-2xl border border-sky-light bg-base-soft p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">{t("history")}</h2>
        <ol className="space-y-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-sm">
              <span className="text-navy-dark">{ts(h.status)}</span>
              <span className="text-xs text-navy/60">{new Date(h.created_at).toLocaleString(locale)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function DriverSlot({
  label,
  task,
  drivers,
  busy,
  onAssign,
}: {
  label: string;
  task: DriverTaskRow | undefined;
  drivers: { id: string; full_name: string | null; phone: string }[];
  busy: boolean;
  onAssign: (driverId: string) => void;
}) {
  const t = useTranslations("admin.orderDetail");
  const [selected, setSelected] = useState("");
  const currentDriver = task ? drivers.find((d) => d.id === task.driver_id) : undefined;

  return (
    <div className="rounded-xl border border-sky-light bg-base p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-navy-dark">{label}</span>
        {task && <StatusBadge kind="driverTask" status={task.status} />}
      </div>
      {task && currentDriver && (
        <p className="mb-2 text-sm text-navy-dark/80">{currentDriver.full_name || currentDriver.phone}</p>
      )}
      <div className="flex gap-1.5">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-sky-light bg-base px-2.5 py-1.5 text-xs outline-none focus:border-navy"
        >
          <option value="">{t("chooseDriver")}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name || d.phone}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !selected}
          onClick={() => onAssign(selected)}
          className="shrink-0 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
        >
          {busy ? t("saving") : task ? t("reassign") : t("assign")}
        </button>
      </div>
    </div>
  );
}
