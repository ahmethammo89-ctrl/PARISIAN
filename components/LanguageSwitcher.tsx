"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { ar: "AR", en: "EN", fr: "FR" };

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 rounded-full border border-sky/40 p-1 text-xs">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            l === locale ? "bg-navy text-base" : "text-navy-dark/60 hover:text-navy-dark"
          }`}
          aria-current={l === locale}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
