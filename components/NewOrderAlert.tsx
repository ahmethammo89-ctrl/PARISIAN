"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OrderRow, SupportMessageRow } from "@/types/database";

const AUTO_DISMISS_MS = 12000;
const RESUBSCRIBE_DELAY_MS = 3000;

type AlertItem = { id: string; kind: "order" | "complaint"; title: string; subtitle: string; href: string };

/** Short two-tone chime via Web Audio API — no audio asset to ship or host. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Autoplay/mic-less environments: fail silently, the toast still shows.
  }
}

export default function NewOrderAlert() {
  const t = useTranslations("admin.newOrderAlert");
  const [queue, setQueue] = useState<AlertItem[]>([]);
  const router = useRouter();
  const [retryTick, setRetryTick] = useState(0);
  const resubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-alerts-${retryTick}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const row = payload.new as OrderRow;
        setQueue((prev) => [...prev, { id: `order:${row.id}`, kind: "order", title: t("title"), subtitle: row.order_number, href: `/admin/orders/${row.id}` }]);
        playChime();
        router.refresh();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: "sender_role=eq.customer" },
        (payload) => {
          const row = payload.new as SupportMessageRow;
          setQueue((prev) => [
            ...prev,
            {
              id: `complaint:${row.id}`,
              kind: "complaint",
              title: t("complaintTitle"),
              subtitle: row.audio_path ? t("voiceMessage") : row.body ?? "",
              href: `/admin/messages/${row.customer_id}`,
            },
          ]);
          playChime();
          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (resubTimer.current) clearTimeout(resubTimer.current);
          resubTimer.current = setTimeout(() => setRetryTick((n) => n + 1), RESUBSCRIBE_DELAY_MS);
        }
      });

    return () => {
      if (resubTimer.current) clearTimeout(resubTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-center gap-2 px-4">
      {queue.map((item) => (
        <div
          key={item.id}
          className="flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-sky-light bg-navy px-4 py-3 text-base shadow-lg"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky">{item.title}</p>
            <p className="truncate text-sm font-medium">{item.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={item.href}
              onClick={() => setQueue((prev) => prev.filter((o) => o.id !== item.id))}
              className="rounded-full bg-base px-3 py-1.5 text-xs font-semibold text-navy-dark hover:bg-sky-pale"
            >
              {t("view")}
            </Link>
            <button
              type="button"
              onClick={() => setQueue((prev) => prev.filter((o) => o.id !== item.id))}
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
