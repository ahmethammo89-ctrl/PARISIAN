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
