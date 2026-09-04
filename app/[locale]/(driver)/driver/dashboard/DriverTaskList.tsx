"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import StatusBadge from "@/components/StatusBadge";
import { driverTaskStatusOptions } from "@/lib/orderFlow";
import { isPhoneLike } from "@/lib/format";
import type { DriverTaskRow, AddressRow, LocalizedText, DriverTaskStatus } from "@/types/database";

type Entry = {
  task: DriverTaskRow;
  order: { id: string; order_number: string; status: string; total_amount: number; payment_status: string };
  address: AddressRow | null;
  branchName: LocalizedText | null;
  customer: { full_name: string | null; phone: string } | null;
};

export default function DriverTaskList({ entries }: { entries: Entry[] }) {
  const t = useTranslations("driver.tasks");
  const active = entries.filter((e) => e.task.status === "assigned" || e.task.status === "en_route");
  const done = entries.filter((e) => e.task.status === "completed" || e.task.status === "failed");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("active")}</h2>
        {active.length === 0 && <p className="text-sm text-navy/60">{t("noActive")}</p>}
        <div className="space-y-3">
          {active.map((e) => (
            <TaskCard key={e.task.id} entry={e} />
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy">{t("completed")}</h2>
          <div className="space-y-2">
            {done.map((e) => (
              <TaskCard key={e.task.id} entry={e} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({ entry, compact }: { entry: Entry; compact?: boolean }) {
  const { task, order, address, branchName, customer } = entry;
  const t = useTranslations("driver.tasks");
  const locale = useLocale() as "ar" | "en" | "fr";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function setStatus(status: DriverTaskStatus) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/driver/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const mapsQuery =
    address?.lat != null && address?.lng != null
      ? `${address.lat},${address.lng}`
      : [address?.address_line, address?.city].filter(Boolean).join(", ");
  const mapsHref = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;
  const customerHasPhone = isPhoneLike(customer?.phone);
  const whatsappHref = customerHasPhone ? `https://wa.me/${customer!.phone.replace(/[^\d]/g, "")}` : null;

  return (
    <div className={`rounded-2xl border border-sky-light bg-base-soft ${compact ? "p-3 opacity-70" : "p-4"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-navy px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base">
              {t(task.task_type)}
            </span>
            <span className="font-medium text-navy-dark">{order.order_number}</span>
          </div>
          <p className="mt-1 text-sm text-navy-dark/80">{customer?.full_name || customer?.phone}</p>
        </div>
        <StatusBadge kind="driverTask" status={task.status} />
      </div>

      {address && (
        <p className="mt-2 text-sm text-navy-dark/80">
          {address.address_line}
          {address.building ? `, ${address.building}` : ""}
          {address.floor ? `, ${address.floor}` : ""}
          {address.city ? `, ${address.city}` : ""}
        </p>
      )}
      <p className="mt-1 text-xs text-navy/60">{branchName?.[locale] ?? branchName?.en}</p>

      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="rounded-full border border-navy/30 px-3 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
                {t("navigate")}
              </a>
            )}
            {customerHasPhone && (
              <>
                <a href={`tel:${customer!.phone}`} className="rounded-full border border-navy/30 px-3 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
                  {t("call")}
                </a>
                <a href={whatsappHref!} target="_blank" rel="noopener noreferrer" className="rounded-full border border-navy/30 px-3 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
                  WhatsApp
                </a>
              </>
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-700">{t("actionFailed")}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {driverTaskStatusOptions(task.status).map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => setStatus(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  s === "failed" ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-navy text-base hover:bg-navy-dark"
                }`}
              >
                {busy ? t("saving") : t(`markAs.${s}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
