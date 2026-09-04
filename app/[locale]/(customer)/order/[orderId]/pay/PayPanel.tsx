"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import type { CreatePaymentResponse } from "@/types/order";

// Business WhatsApp number from the Parisian Laundry business card
// (03 703442), in wa.me international format. Override with
// NEXT_PUBLIC_WHATSAPP_NUMBER if the other branch line should be used
// instead.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9613703442";

type OrderSummary = {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  status: string;
};

export default function PayPanel({ order, itemCount }: { order: OrderSummary; itemCount: number }) {
  const t = useTranslations("order.pay");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState<"whish" | "cash" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(order.status !== "pending_confirmation");
  const paid = order.payment_status === "paid";

  async function pay(method: "whish" | "cash") {
    setLoading(method);
    setError(null);
    try {
      const res = await fetch("/api/payments/whish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, method }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "payment_failed");
      }
      const data: CreatePaymentResponse = await res.json();

      if (method === "cash") {
        setResolved(true);
        return;
      }
      if (data.mocked && data.paymentUrl) {
        router.push(data.paymentUrl);
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "payment_failed");
    } finally {
      setLoading(null);
    }
  }

  const whatsappText = encodeURIComponent(
    `${t("title", { orderNumber: order.order_number })} — ${formatPrice(order.total_amount, locale)} (${itemCount} items)`
  );
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`;

  if (resolved) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-pale text-3xl text-navy">✓</div>
        <h1 className="font-heading mb-2 text-2xl text-navy-dark">{paid ? t("paid") : t("cashConfirmed")}</h1>
        <p className="mb-6 text-sm text-sky">{t("title", { orderNumber: order.order_number })}</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark"
        >
          {t("backToDashboard")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="font-heading mb-1 text-2xl text-navy-dark">{t("title", { orderNumber: order.order_number })}</h1>
      <p className="mb-8 text-sm text-sky">{itemCount} items</p>

      <div className="mb-8 rounded-2xl border border-sky-light bg-base-soft p-5 text-center">
        <p className="text-xs text-sky">{t("totalDue")}</p>
        <p className="font-heading text-3xl text-navy-dark">{formatPrice(order.total_amount, locale)}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => pay("whish")}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
        >
          {loading === "whish" ? t("processing") : t("payWhish")}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => pay("cash")}
          className="rounded-full border-2 border-navy px-5 py-3 text-sm font-semibold text-navy-dark hover:bg-sky-pale disabled:opacity-50"
        >
          {loading === "cash" ? t("processing") : t("payCash")}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-sky-light px-5 py-3 text-sm font-medium text-navy-dark hover:bg-sky-pale"
        >
          {t("whatsapp")}
        </a>
      </div>
    </div>
  );
}
