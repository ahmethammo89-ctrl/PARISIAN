import type { Metadata } from "next";
import Image from "next/image";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, localeDirection, type AppLocale } from "@/i18n/routing";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: `${t("appName")} — ${t("tagline")}`,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale's server components.
  setRequestLocale(locale);

  const direction = localeDirection[locale as AppLocale];

  return (
    <html lang={locale} dir={direction}>
      <body className="min-h-screen bg-base text-navy-dark font-body antialiased">
        <NextIntlClientProvider>
          <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-sky-light/60 bg-base/90 backdrop-blur supports-backdrop-blur:bg-base/70 sticky top-0 z-40">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt={locale === "ar" ? "المصبغة الباريسية" : "Parisian Laundry"}
                width={40}
                height={40}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full ring-1 ring-sky-light"
                priority
              />
              <span className="font-heading text-base sm:text-lg tracking-wide text-navy-dark hidden sm:inline">
                {locale === "ar" ? "المصبغة الباريسية" : "Parisian Laundry"}
              </span>
            </Link>
            <LanguageSwitcher />
          </header>
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
