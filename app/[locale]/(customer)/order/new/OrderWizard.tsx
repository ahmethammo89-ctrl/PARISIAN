"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeOrderTotals } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import ItemPhotoSlot, { type ItemDraft } from "./ItemPhotoSlot";
import type {
  ServiceCategoryRow,
  ServiceRow,
  SchedulePricingRow,
  AddressRow,
  BranchRow,
  LocalizedText,
  FoldType,
  StarchLevel,
  ScheduleType,
} from "@/types/database";
import type { CreateOrderBody, CreateOrderResponse } from "@/types/order";

function localName(text: LocalizedText, locale: string) {
  return text[locale as keyof LocalizedText] ?? text.en;
}

type CartLine = {
  key: string;
  serviceId: string;
  serviceName: string;
  basePrice: number;
  requiresFold: boolean;
  requiresStarch: boolean;
  quantity: number;
  foldType: FoldType | null;
  starchLevel: StarchLevel | null;
  items: ItemDraft[];
};

function makeLine(service: ServiceRow, locale: string, quantity: number): CartLine {
  return {
    key: service.id,
    serviceId: service.id,
    serviceName: localName(service.name, locale),
    basePrice: service.base_price,
    requiresFold: service.requires_fold_option,
    requiresStarch: service.requires_starch_option,
    quantity,
    foldType: service.requires_fold_option ? "folded" : null,
    starchLevel: service.requires_starch_option ? "none" : null,
    items: Array.from({ length: quantity }, () => ({ file: null, previewUrl: null, note: "" })),
  };
}

function resizeItems(items: ItemDraft[], quantity: number) {
  const next = [...items];
  while (next.length < quantity) next.push({ file: null, previewUrl: null, note: "" });
  while (next.length > quantity) {
    const removed = next.pop();
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  }
  return next;
}

const STEP_KEYS = ["services", "customize", "schedule", "review"] as const;

export default function OrderWizard({
  categories,
  services,
  schedulePricing,
  addresses,
  branches,
}: {
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
  schedulePricing: SchedulePricingRow[];
  addresses: AddressRow[];
  branches: BranchRow[];
}) {
  const t = useTranslations("order");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scheduleType, setScheduleType] = useState<ScheduleType | null>(null);
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [addressList, setAddressList] = useState<AddressRow[]>(addresses);
  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null
  );
  const [showNewAddress, setShowNewAddress] = useState(addresses.length === 0);
  const [newAddress, setNewAddress] = useState({ label: "", addressLine: "", building: "", floor: "", city: "" });
  const [savingAddress, setSavingAddress] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricingLines = useMemo(
    () => cart.map((l) => ({ basePrice: l.basePrice, quantity: l.quantity })),
    [cart]
  );
  const activeMultiplier = schedulePricing.find((s) => s.schedule_type === scheduleType)?.price_multiplier ?? 1;
  const totals = useMemo(() => computeOrderTotals(pricingLines, activeMultiplier), [pricingLines, activeMultiplier]);

  function addService(service: ServiceRow) {
    setCart((prev) => {
      const existing = prev.find((l) => l.serviceId === service.id);
      if (existing) return prev.map((l) => (l.key === existing.key ? setQty(l, l.quantity + 1) : l));
      return [...prev, makeLine(service, locale, 1)];
    });
  }

  function setQty(line: CartLine, quantity: number): CartLine {
    return { ...line, quantity, items: resizeItems(line.items, quantity) };
  }

  function updateQuantity(key: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    setCart((prev) => prev.map((l) => (l.key === key ? setQty(l, Math.min(20, quantity)) : l)));
  }

  function updateLine(key: string, patch: Partial<Pick<CartLine, "foldType" | "starchLevel">>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function updateItem(key: string, index: number, next: ItemDraft) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const items = [...l.items];
        items[index] = next;
        return { ...l, items };
      })
    );
  }

  async function handleSaveAddress() {
    if (!newAddress.addressLine.trim()) return;
    setSavingAddress(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingAddress(false);
      return;
    }
    const { data, error: insertError } = await supabase
      .from("addresses")
      .insert({
        customer_id: user.id,
        label: newAddress.label || null,
        address_line: newAddress.addressLine,
        building: newAddress.building || null,
        floor: newAddress.floor || null,
        city: newAddress.city || null,
        is_default: addressList.length === 0,
      })
      .select()
      .single();
    setSavingAddress(false);
    if (insertError || !data) {
      setError(t("errors.generic"));
      return;
    }
    setAddressList((prev) => [...prev, data]);
    setAddressId(data.id);
    setShowNewAddress(false);
    setNewAddress({ label: "", addressLine: "", building: "", floor: "", city: "" });
  }

  async function handleSubmit() {
    if (!scheduleType) {
      setError(t("errors.selectSchedule"));
      return;
    }
    if (!addressId) {
      setError(t("errors.selectAddress"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateOrderBody = {
        addressId,
        branchId,
        scheduleType,
        customerNotes: customerNotes || undefined,
        lines: cart.map((l) => ({
          serviceId: l.serviceId,
          quantity: l.quantity,
          foldType: l.foldType,
          starchLevel: l.starchLevel,
          itemNotes: l.items.map((i) => i.note || null),
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || t("errors.generic"));
      }
      const data: CreateOrderResponse = await res.json();

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uploads: Promise<void>[] = [];
      if (user) {
        for (const line of cart) {
          line.items.forEach((item, idx) => {
            if (!item.file) return;
            const orderItem = data.items.find(
              (oi) => oi.service_id === line.serviceId && oi.item_index === idx + 1
            );
            if (!orderItem) return;
            uploads.push(
              (async () => {
                const path = `${user.id}/${orderItem.id}/${Date.now()}.jpg`;
                const { error: upErr } = await supabase.storage
                  .from("item-photos")
                  .upload(path, item.file as File, { contentType: item.file?.type || "image/jpeg" });
                if (upErr) return;
                await supabase.from("order_item_photos").insert({
                  order_item_id: orderItem.id,
                  photo_url: path,
                  photo_type: "customer_intake",
                  uploaded_by: user.id,
                });
              })()
            );
          });
        }
      }
      if (uploads.length) await Promise.all(uploads);

      router.push(`/order/${data.order.id}/pay`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setSubmitting(false);
    }
  }

  const canContinue =
    (step === 1 && cart.length > 0) || (step === 2 && true) || (step === 3 && !!scheduleType && !!addressId) || false;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-6 sm:px-6">
      <ol className="mb-8 flex items-center gap-2">
        {STEP_KEYS.map((key, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "active" : "todo";
          return (
            <li key={key} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "todo"
                    ? "bg-sky-pale text-sky"
                    : state === "active"
                      ? "bg-navy text-base"
                      : "bg-navy-dark text-base"
                }`}
              >
                {state === "done" ? "✓" : n}
              </span>
              <span className={`hidden text-xs font-medium sm:inline ${state === "todo" ? "text-sky" : "text-navy-dark"}`}>
                {t(`steps.${key}`)}
              </span>
              {i < STEP_KEYS.length - 1 && <span className="h-px flex-1 bg-sky-light" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-8">
          {cart.length === 0 && <p className="text-sm text-sky">{t("cartEmpty")}</p>}
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category_id === cat.id);
            if (catServices.length === 0) return null;
            return (
              <section key={cat.id}>
                <h2 className="font-heading mb-3 text-lg text-navy-dark">
                  {localName(cat.name, locale)}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {catServices.map((service) => {
                    const line = cart.find((l) => l.serviceId === service.id);
                    return (
                      <div
                        key={service.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-sky-light bg-base-soft px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-navy-dark">
                            {localName(service.name, locale)}
                            {service.is_haute_couture && (
                              <span className="ms-2 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base">
                                {t("services.haute")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-sky">
                            {t("services.from")} {formatPrice(service.base_price, locale)}
                          </p>
                        </div>
                        {line ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.key, line.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-sky text-sky hover:bg-sky-pale"
                              aria-label="-"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-semibold text-navy-dark">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.key, line.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-sky text-sky hover:bg-sky-pale"
                              aria-label="+"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addService(service)}
                            className="shrink-0 rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark"
                          >
                            {t("services.add")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-8">
          {cart.map((line) => (
            <section key={line.key} className="rounded-2xl border border-sky-light p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy-dark">
                  {t("customize.lineTitle", { service: line.serviceName, count: line.quantity })}
                </h3>
                <button
                  type="button"
                  onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                  className="text-xs text-sky hover:underline"
                >
                  {t("cart.remove")}
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-4">
                {line.requiresFold && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-sky">{t("customize.foldType")}</p>
                    <div className="flex gap-1.5">
                      {(["folded", "hanger"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => updateLine(line.key, { foldType: opt })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            line.foldType === opt ? "bg-navy text-base" : "bg-sky-pale text-navy-dark hover:bg-sky-light"
                          }`}
                        >
                          {t(`customize.${opt}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {line.requiresStarch && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-sky">{t("customize.starchLevel")}</p>
                    <div className="flex gap-1.5">
                      {(["none", "light", "medium", "heavy"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => updateLine(line.key, { starchLevel: opt })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            line.starchLevel === opt ? "bg-navy text-base" : "bg-sky-pale text-navy-dark hover:bg-sky-light"
                          }`}
                        >
                          {t(`customize.starch${opt[0].toUpperCase()}${opt.slice(1)}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="mb-2 text-xs text-sky">{t("customize.photoHint")}</p>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x-mandatory">
                {line.items.map((item, idx) => (
                  <ItemPhotoSlot
                    key={idx}
                    index={idx + 1}
                    total={line.quantity}
                    item={item}
                    onChange={(next) => updateItem(line.key, idx, next)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="font-heading mb-3 text-lg text-navy-dark">{t("schedule.title")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {schedulePricing
                .slice()
                .sort((a, b) => a.price_multiplier - b.price_multiplier)
                .map((sp) => {
                  const previewTotal = computeOrderTotals(pricingLines, sp.price_multiplier).total;
                  const percent = Math.round((sp.price_multiplier - 1) * 100);
                  const active = scheduleType === sp.schedule_type;
                  return (
                    <button
                      key={sp.schedule_type}
                      type="button"
                      onClick={() => setScheduleType(sp.schedule_type)}
                      className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 px-4 py-3.5 text-start transition-colors ${
                        active ? "border-navy bg-sky-pale" : "border-sky-light hover:border-sky"
                      }`}
                    >
                      <span className="text-sm font-semibold text-navy-dark">
                        {t(`schedule.${sp.schedule_type}Title`)}
                      </span>
                      <span className="text-xs text-sky">{t("schedule.turnaround", { hours: sp.turnaround_hours })}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          percent === 0 ? "bg-sky-light text-navy-dark" : "bg-navy text-base"
                        }`}
                      >
                        {percent === 0 ? t("schedule.noFee") : t("schedule.extraFee", { percent })}
                      </span>
                      {cart.length > 0 && (
                        <span className="mt-1 text-sm font-semibold text-navy-dark">{formatPrice(previewTotal, locale)}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </section>

          {branches.length > 1 && (
            <section>
              <h2 className="font-heading mb-3 text-lg text-navy-dark">{t("branch.title")}</h2>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-sky-light bg-base px-3 py-2.5 text-sm text-navy-dark focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky/40"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {localName(b.name, locale)}
                  </option>
                ))}
              </select>
            </section>
          )}

          <section>
            <h2 className="font-heading mb-3 text-lg text-navy-dark">{t("address.title")}</h2>
            {addressList.length === 0 && <p className="mb-3 text-sm text-sky">{t("address.noAddresses")}</p>}
            <div className="mb-3 flex flex-col gap-2">
              {addressList.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 ${
                    addressId === addr.id ? "border-navy bg-sky-pale" : "border-sky-light"
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === addr.id}
                    onChange={() => setAddressId(addr.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-navy-dark">
                    {addr.label && <span className="font-medium">{addr.label} — </span>}
                    {addr.address_line}
                    {addr.building ? `, ${addr.building}` : ""}
                    {addr.city ? `, ${addr.city}` : ""}
                  </span>
                </label>
              ))}
            </div>

            {showNewAddress ? (
              <div className="flex flex-col gap-2 rounded-xl border border-sky-light p-4">
                <input
                  value={newAddress.label}
                  onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))}
                  placeholder={t("address.label")}
                  className="rounded-lg border border-sky-light px-3 py-2 text-sm focus:border-sky focus:outline-none"
                />
                <input
                  value={newAddress.addressLine}
                  onChange={(e) => setNewAddress((p) => ({ ...p, addressLine: e.target.value }))}
                  placeholder={t("address.addressLine")}
                  className="rounded-lg border border-sky-light px-3 py-2 text-sm focus:border-sky focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newAddress.building}
                    onChange={(e) => setNewAddress((p) => ({ ...p, building: e.target.value }))}
                    placeholder={t("address.building")}
                    className="rounded-lg border border-sky-light px-3 py-2 text-sm focus:border-sky focus:outline-none"
                  />
                  <input
                    value={newAddress.floor}
                    onChange={(e) => setNewAddress((p) => ({ ...p, floor: e.target.value }))}
                    placeholder={t("address.floor")}
                    className="rounded-lg border border-sky-light px-3 py-2 text-sm focus:border-sky focus:outline-none"
                  />
                </div>
                <input
                  value={newAddress.city}
                  onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                  placeholder={t("address.city")}
                  className="rounded-lg border border-sky-light px-3 py-2 text-sm focus:border-sky focus:outline-none"
                />
                <button
                  type="button"
                  disabled={savingAddress || !newAddress.addressLine.trim()}
                  onClick={handleSaveAddress}
                  className="mt-1 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-base hover:bg-navy-dark disabled:opacity-50"
                >
                  {savingAddress ? t("address.saving") : t("address.save")}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowNewAddress(true)} className="text-sm text-sky hover:underline">
                {t("address.addNew")}
              </button>
            )}
          </section>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-sky-light p-4">
            <h2 className="font-heading mb-3 text-lg text-navy-dark">{t("cart.title")}</h2>
            <div className="flex flex-col gap-2">
              {cart.map((line) => (
                <div key={line.key} className="flex items-center justify-between text-sm">
                  <span className="text-navy-dark">
                    {line.serviceName} <span className="text-sky">× {line.quantity}</span>
                  </span>
                  <span className="font-medium text-navy-dark">{formatPrice(line.basePrice * line.quantity, locale)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-sky-light pt-3 text-sm">
              <div className="flex justify-between text-navy-dark">
                <span>{t("review.subtotal")}</span>
                <span>{formatPrice(totals.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-navy-dark">
                <span>{t("review.scheduleFee")}</span>
                <span>{formatPrice(totals.scheduleFee, locale)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-navy-dark">
                <span>{t("review.total")}</span>
                <span>{formatPrice(totals.total, locale)}</span>
              </div>
            </div>
          </section>

          <section>
            <label className="mb-1.5 block text-sm font-medium text-navy-dark">{t("review.notesLabel")}</label>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder={t("review.notesPlaceholder")}
              rows={3}
              className="w-full resize-none rounded-lg border border-sky-light bg-base px-3 py-2.5 text-sm text-navy-dark focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky/40"
            />
          </section>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-light bg-base/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-sky">{t("review.total")}</p>
            <p className="text-lg font-semibold text-navy-dark">{formatPrice(totals.total, locale)}</p>
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full border border-sky px-5 py-2.5 text-sm font-medium text-navy-dark hover:bg-sky-pale"
              >
                {t("back")}
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-40"
              >
                {t("next")}
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={handleSubmit}
                className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-40"
              >
                {submitting ? t("review.placing") : t("review.placeOrder")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
