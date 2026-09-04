"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { UserRole } from "@/types/database";

const ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];

const ITEMS: {
  href: "/admin/dashboard" | "/admin/orders" | "/admin/scan" | "/admin/catalog" | "/admin/users";
  key: string;
  adminOnly?: boolean;
}[] = [
  { href: "/admin/dashboard", key: "dashboard" },
  { href: "/admin/orders", key: "orders" },
  { href: "/admin/scan", key: "scan" },
  { href: "/admin/catalog", key: "catalog" },
  { href: "/admin/users", key: "users", adminOnly: true },
];

export default function AdminNav({ role }: { role: UserRole }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const items = ITEMS.filter((item) => !item.adminOnly || ADMIN_ROLES.includes(role));

  return (
    <nav className="sticky top-[57px] sm:top-[65px] z-30 flex gap-1 overflow-x-auto border-b border-sky-light/60 bg-base/95 px-4 py-2 backdrop-blur sm:px-6">
      {items.map(({ href, key }) => {
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
