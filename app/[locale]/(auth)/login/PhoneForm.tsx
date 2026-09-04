"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Kept fully visible per the brand's original phone-first design — but
// its loading/error state is entirely local to this component, so an SMS
// provider that isn't configured yet (send fails) can never disable or
// visually block the Google or email/password sections above it.
export default function PhoneForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });

    setLoading(false);
    if (otpError) {
      setError(t("errorGeneric"));
      return;
    }
    router.push(`/verify?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="text-sm font-medium text-navy-dark/80">
          {t("phoneLabel")}
        </label>
        <input
          id="phone"
          type="tel"
          required
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
          className="w-full rounded-lg border border-navy-dark/15 bg-white px-4 py-3 text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg border-2 border-navy px-4 py-3 font-medium text-navy-dark transition-colors hover:bg-sky-pale disabled:opacity-50"
      >
        {loading ? t("sending") : t("sendCode")}
      </button>
    </form>
  );
}
