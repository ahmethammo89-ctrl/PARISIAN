"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    setLoading(false);
    if (verifyError) {
      setError(t("errorInvalidCode"));
      return;
    }

    // Role-based redirect lives in the "/" server component.
    router.push("/");
    router.refresh();
  }

  async function handleResend() {
    setError(null);
    await supabase.auth.signInWithOtp({ phone });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium text-navy-dark/80">
          {t("codeLabel")}
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="w-full rounded-lg border border-navy-dark/15 bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-navy-dark focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-navy px-4 py-3 font-medium text-base transition-colors hover:bg-navy-dark disabled:opacity-50"
      >
        {loading ? t("verifying") : t("verifyButton")}
      </button>

      <button
        type="button"
        onClick={handleResend}
        className="text-sm text-navy underline-offset-4 hover:underline"
      >
        {t("resendCode")}
      </button>
    </form>
  );
}
