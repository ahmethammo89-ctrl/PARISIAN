"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/admin/dashboard", key: "dashboard" },
  { href: "/admin/orders", key: "orders" },
  { href: "/admin/scan", key: "scan" },
] as const;

export default function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  return (
    <nav className="sticky top-[57px] sm:top-[65px] z-30 flex gap-1 overflow-x-auto border-b border-sky-light/60 bg-base/95 px-4 py-2 backdrop-blur sm:px-6">
      {ITEMS.map(({ href, key }) => {
        const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-navy text-base" : "text-navy-dark/70 hover:bg-sky-pale"
            }`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
