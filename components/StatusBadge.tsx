"use client";

import { useTranslations } from "next-intl";

const TONES: Record<string, string> = {
  // order
  pending_confirmation: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-pale text-navy",
  picked_up: "bg-sky-pale text-navy",
  in_processing: "bg-blue-100 text-blue-800",
  ready_for_delivery: "bg-teal-100 text-teal-800",
  out_for_delivery: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  // item (shares some keys with order — kept distinct where meaning differs)
  registered: "bg-sky-pale text-navy",
  tagged: "bg-sky-pale text-navy",
  cleaned: "bg-blue-100 text-blue-800",
  ready: "bg-teal-100 text-teal-800",
  lost: "bg-red-100 text-red-700",
  damaged: "bg-red-100 text-red-700",
  // driver task
  assigned: "bg-sky-pale text-navy",
  en_route: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
};

export default function StatusBadge({ kind, status }: { kind: "order" | "item" | "driverTask"; status: string }) {
  const t = useTranslations(`status.${kind}`);
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[status] ?? "bg-sky-pale text-navy"}`}>
      {t(status)}
    </span>
  );
}
