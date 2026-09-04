"use client";

import { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import type { CreatePaymentResponse } from "@/types/order";

// Business WhatsApp number from the Parisian Laundry business card
// (03 703442), in wa.me international format. Override with
// NEXT_PUBLIC_WHATSAPP_NUMBER if the other branch line should be used
// instead.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9613703442";

// The single company Whish number customers transfer to. Whish is run
// manually (no live merchant API integration yet): customer transfers
// to this number in their own Whish app, then submits a screenshot +
// the transaction ID here for staff to verify.
const WHISH_NUMBER = process.env.NEXT_PUBLIC_WHISH_NUMBER || "+9613703442";

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

  const [loading, setLoading] = useState<"cash" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(order.status !== "pending_confirmation");
  const [showWhishForm, setShowWhishForm] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const paid = order.payment_status === "paid";

  async function pay(method: "cash") {
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
      if (data) setResolved(true);
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

  if (resolved || proofSubmitted) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-pale text-3xl text-navy">✓</div>
        <h1 className="font-heading mb-2 text-2xl text-navy-dark">
          {paid ? t("paid") : proofSubmitted ? t("proofSubmitted") : t("cashConfirmed")}
        </h1>
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

      {!showWhishForm && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => setShowWhishForm(true)}
            className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
          >
            {t("payWhish")}
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
      )}

      {showWhishForm && (
        <WhishProofForm
          orderId={order.id}
          amount={order.total_amount}
          locale={locale}
          onCancel={() => setShowWhishForm(false)}
          onSubmitted={() => setProofSubmitted(true)}
        />
      )}
    </div>
  );
}

function WhishProofForm({
  orderId,
  amount,
  locale,
  onCancel,
  onSubmitted,
}: {
  orderId: string;
  amount: number;
  locale: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const t = useTranslations("order.pay");
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactionId, setTransactionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !transactionId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error();

      const path = `${user.id}/payments/${orderId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("item-photos").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { error: insertErr } = await supabase.from("payments").insert({
        order_id: orderId,
        provider: "whish",
        amount,
        status: "pending",
        provider_reference: transactionId.trim(),
        proof_photo_url: path,
      });
      if (insertErr) throw insertErr;

      onSubmitted();
    } catch {
      setError(t("proofFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-sky-light bg-base-soft p-4 text-sm text-navy-dark">
        <p className="mb-1 font-semibold">{t("whishInstructionsTitle")}</p>
        <p>{t("whishInstructions", { number: WHISH_NUMBER, amount: formatPrice(amount, locale) })}</p>
      </div>

      <label className="block text-xs font-medium text-navy-dark/70">
        {t("transactionIdLabel")}
        <input
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          required
          placeholder="586680639"
          className="mt-1 w-full rounded-lg border border-navy-dark/15 bg-white px-4 py-3 text-sm focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-navy-dark/70">{t("proofPhotoLabel")}</p>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" onClick={() => fileRef.current?.click()} className="h-40 w-full cursor-pointer rounded-xl border border-sky-light object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-sky-light text-sm text-sky hover:bg-sky-pale"
          >
            {t("uploadProof")}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy || !file || !transactionId.trim()}
          className="flex-1 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
        >
          {busy ? t("processing") : t("submitProof")}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border-2 border-navy px-5 py-3 text-sm font-semibold text-navy-dark hover:bg-sky-pale">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
