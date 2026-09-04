"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OrderRow } from "@/types/database";

const AUTO_DISMISS_MS = 10000;

export default function NewOrderAlert() {
  const t = useTranslations("admin.newOrderAlert");
  const [queue, setQueue] = useState<OrderRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as OrderRow;
          setQueue((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-center gap-2 px-4">
      {queue.map((order) => (
        <div
          key={order.id}
          className="flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-sky-light bg-navy px-4 py-3 text-base shadow-lg"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky">{t("title")}</p>
            <p className="text-sm font-medium">{order.order_number}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/admin/orders/${order.id}`}
              onClick={() => setQueue((prev) => prev.filter((o) => o.id !== order.id))}
              className="rounded-full bg-base px-3 py-1.5 text-xs font-semibold text-navy-dark hover:bg-sky-pale"
            >
              {t("view")}
            </Link>
            <button
              type="button"
              onClick={() => setQueue((prev) => prev.filter((o) => o.id !== order.id))}
              aria-label={t("dismiss")}
              className="text-base/70 hover:text-base"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
