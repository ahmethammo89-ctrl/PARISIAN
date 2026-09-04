// Prices are stored as plain USD numbers (common practice for
// service pricing in Lebanon). Swap the currency here if the business
// prices in LBP instead — it's the one place this formatting lives.
export function formatPrice(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-LB" : locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// profiles.phone is populated from whatever identifier the sign-in method
// provided — a real phone for OTP sign-ins, but the trigger falls back to
// the email address for Google/email-password accounts (see
// handle_new_auth_user() in supabase/01_schema.sql). Call/WhatsApp buttons
// use this guard so they never render a broken tel:/wa.me link built from
// an email address.
export function isPhoneLike(value: string | null | undefined): value is string {
  if (!value || value.includes("@")) return false;
  return (value.match(/\d/g)?.length ?? 0) >= 7;
}
