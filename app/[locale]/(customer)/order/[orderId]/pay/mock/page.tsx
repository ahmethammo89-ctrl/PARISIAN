"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function MockWhishCheckout() {
  const t = useTranslations("order.pay");
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulateSuccess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/whish/mock-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: params.orderId }),
      });
      if (!res.ok) throw new Error("mock_confirm_failed");
      router.push(`/order/${params.orderId}/pay`);
      router.refresh();
    } catch {
      setError(t("processing"));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 w-full rounded-2xl border-2 border-dashed border-sky bg-sky-pale px-4 py-2 text-xs font-medium text-navy-dark">
        {t("mockBanner")}
      </div>
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-2xl text-base">W</div>
      <h1 className="font-heading mb-2 text-xl text-navy-dark">{t("mockTitle")}</h1>
      <p className="mb-8 text-sm text-sky">{t("mockDesc")}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={simulateSuccess}
        className="w-full rounded-full bg-navy px-5 py-3 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
      >
        {loading ? t("processing") : t("simulateSuccess")}
      </button>
    </div>
  );
}
