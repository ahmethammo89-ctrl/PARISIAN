"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { OrderStatus, LocalizedText } from "@/types/database";

export default function OrderFilters({
  branches,
  statuses,
}: {
  branches: { id: string; name: LocalizedText }[];
  statuses: OrderStatus[];
}) {
  const t = useTranslations("admin.orders");
  const ts = useTranslations("status.order");
  const locale = useLocale() as "ar" | "en" | "fr";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setParam("q", q)}
        onBlur={() => setParam("q", q)}
        placeholder={t("searchPlaceholder")}
        className="min-w-40 flex-1 rounded-full border border-sky-light bg-base px-4 py-2 text-sm outline-none focus:border-navy"
      />
      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="rounded-full border border-sky-light bg-base px-3 py-2 text-sm outline-none focus:border-navy"
      >
        <option value="">{t("allStatuses")}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {ts(s)}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("branch") ?? ""}
        onChange={(e) => setParam("branch", e.target.value)}
        className="rounded-full border border-sky-light bg-base px-3 py-2 text-sm outline-none focus:border-navy"
      >
        <option value="">{t("allBranches")}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name[locale] ?? b.name.en}
          </option>
        ))}
      </select>
    </div>
  );
}
