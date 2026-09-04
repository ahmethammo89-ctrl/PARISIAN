"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import type {
  OrderRow,
  AddressRow,
  OrderItemRow,
  OrderItemPhotoRow,
  PaymentRow,
  LocalizedText,
  FoldType,
  StarchLevel,
} from "@/types/database";

type ItemWithExtras = OrderItemRow & {
  serviceName?: LocalizedText;
  requiresFold: boolean;
  requiresStarch: boolean;
  photos: (OrderItemPhotoRow & { signedUrl: string | null })[];
};

const FOLD_OPTIONS: FoldType[] = ["folded", "hanger"];
const STARCH_OPTIONS: StarchLevel[] = ["none", "light", "medium", "heavy"];
const STARCH_KEY: Record<StarchLevel, string> = { none: "starchNone", light: "starchLight", medium: "starchMedium", heavy: "starchHeavy" };

export default function CustomerOrderDetail({
  order,
  address,
  branchName,
  items,
  payments,
}: {
  order: OrderRow;
  address: AddressRow | null;
  branchName: LocalizedText | null;
  items: ItemWithExtras[];
  payments: PaymentRow[];
}) {
  const t = useTranslations("order.detail");
  const ts = useTranslations("status.order");
  const locale = useLocale() as "ar" | "en" | "fr";

  // Matches the DB write policy (05_service_images_chat_and_edit_lock.sql):
  // customer can edit item options only up to staff confirmation, not after.
  const editable = order.status === "pending_confirmation";
  const latestPayment = payments[0];
  const awaitingReview = latestPayment && latestPayment.provider === "whish" && latestPayment.status === "pending" && !!latestPayment.proof_photo_url;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl text-navy-dark">{order.order_number}</h1>
        <StatusBadge kind="order" status={order.status} />
      </div>
      <p className="mb-6 text-sm text-navy/70">{new Date(order.created_at).toLocaleString(locale)}</p>

      <section className="mb-5 rounded-2xl border border-sky-light bg-base-soft p-4">
        <p className="text-sm text-navy-dark">
          {t("total")}: <span className="font-semibold">{formatPrice(order.total_amount, locale)}</span>
        </p>
        {address && (
          <p className="mt-1 text-sm text-navy-dark/80">
            {address.address_line}
            {address.building ? `, ${address.building}` : ""}
            {address.city ? `, ${address.city}` : ""}
          </p>
        )}
        <p className="mt-1 text-xs text-navy/60">{branchName?.[locale] ?? branchName?.en}</p>

        {order.payment_status === "paid" ? (
          <p className="mt-3 text-sm font-medium text-teal">{t("paid")}</p>
        ) : awaitingReview ? (
          <p className="mt-3 text-sm text-amber-700">{t("awaitingReview")}</p>
        ) : (
          <Link
            href={`/order/${order.id}/pay`}
            className="mt-3 inline-block rounded-full bg-navy px-5 py-2 text-sm font-semibold text-base hover:bg-navy-dark"
          >
            {t("payNow")}
          </Link>
        )}
      </section>

      {!editable && <p className="mb-3 text-xs text-navy/60">{t("editLocked")}</p>}

      <section className="mb-5 space-y-2">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} locale={locale} editable={editable} />
        ))}
      </section>

      <Link href="/dashboard" className="mt-6 inline-block text-sm text-navy hover:underline">
        {t("backToDashboard")}
      </Link>
    </div>
  );
}

function ItemCard({ item, locale, editable }: { item: ItemWithExtras; locale: "ar" | "en" | "fr"; editable: boolean }) {
  const t = useTranslations("order.detail");
  const tc = useTranslations("order.customize");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fold, setFold] = useState<FoldType | "">(item.fold_type ?? "");
  const [starch, setStarch] = useState<StarchLevel | "">(item.starch_level ?? "");
  const [notes, setNotes] = useState(item.stain_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("order_items")
      .update({ fold_type: fold || null, starch_level: starch || null, stain_notes: notes || null })
      .eq("id", item.id);
    setBusy(false);
    if (err) {
      setError(true);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-sky-light bg-base-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-navy-dark">{item.serviceName?.[locale] ?? item.serviceName?.en}</p>
          <p className="mt-0.5 font-mono text-xs text-navy/60">{item.barcode}</p>
        </div>
        <StatusBadge kind="item" status={item.status} />
      </div>

      {item.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {item.photos.map(
            (p) =>
              p.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.signedUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-sky-light object-cover" />
              )
          )}
        </div>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          {item.requiresFold && (
            <label className="block text-xs font-medium text-navy-dark/70">
              {tc("foldType")}
              <select value={fold} onChange={(e) => setFold(e.target.value as FoldType)} className="mt-1 w-full rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm">
                <option value="">—</option>
                {FOLD_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {tc(f)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {item.requiresStarch && (
            <label className="block text-xs font-medium text-navy-dark/70">
              {tc("starchLevel")}
              <select value={starch} onChange={(e) => setStarch(e.target.value as StarchLevel)} className="mt-1 w-full rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm">
                <option value="">—</option>
                {STARCH_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {tc(STARCH_KEY[s])}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-medium text-navy-dark/70">
            {tc("addNote")}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={tc("notePlaceholder")}
              className="mt-1 w-full rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-xs text-red-700">{t("editFailed")}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
            >
              {busy ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-navy/20 px-4 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {(item.fold_type || item.starch_level || item.stain_notes) && (
            <p className="mt-2 text-xs text-navy-dark/70">
              {[item.fold_type && tc(item.fold_type), item.starch_level && tc(STARCH_KEY[item.starch_level]), item.stain_notes].filter(Boolean).join(" · ")}
            </p>
          )}
          {editable && (item.requiresFold || item.requiresStarch || true) && (
            <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs font-medium text-navy hover:underline">
              {t("editItem")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
