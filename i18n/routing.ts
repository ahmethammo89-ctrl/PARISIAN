import { defineRouting } from "next-intl/routing";

// Supported locales. Arabic is default (primary market = Lebanon) and RTL.
export const routing = defineRouting({
  locales: ["ar", "en", "fr"],
  defaultLocale: "ar",
  localePrefix: "always", // /ar/..., /en/..., /fr/...
});

export type AppLocale = (typeof routing.locales)[number];

export const localeDirection: Record<AppLocale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
  fr: "ltr",
};
