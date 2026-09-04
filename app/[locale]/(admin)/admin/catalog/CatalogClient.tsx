"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { ServiceCategoryRow, ServiceRow, LocalizedText } from "@/types/database";

const inputCls =
  "w-full rounded-lg border border-navy-dark/15 bg-white px-3 py-2 text-sm text-start text-navy-dark placeholder:text-navy-dark/30 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30";
const smallInputCls = inputCls + " sm:w-28";

export default function CatalogClient({
  initialCategories,
  initialServices,
}: {
  initialCategories: ServiceCategoryRow[];
  initialServices: ServiceRow[];
}) {
  const t = useTranslations("admin.catalog");
  const locale = useLocale() as "ar" | "en" | "fr";
  const supabase = createClient();

  const [categories, setCategories] = useState(initialCategories);
  const [services, setServices] = useState(initialServices);
  const [showNewCategory, setShowNewCategory] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl text-navy-dark sm:text-3xl">{t("title")}</h1>
        <button
          type="button"
          onClick={() => setShowNewCategory((s) => !s)}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark"
        >
          {showNewCategory ? t("cancel") : t("newCategory")}
        </button>
      </div>

      {showNewCategory && (
        <NewCategoryForm
          supabase={supabase}
          nextSortOrder={categories.length}
          onCreated={(c) => {
            setCategories((prev) => [...prev, c]);
            setShowNewCategory(false);
          }}
        />
      )}

      <div className="mt-8 space-y-8">
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            services={services.filter((s) => s.category_id === cat.id)}
            locale={locale}
            supabase={supabase}
            onCategoryChange={(patch) =>
              setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...patch } : c)))
            }
            onServiceAdded={(s) => setServices((prev) => [...prev, s])}
            onServiceChange={(id, patch) =>
              setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
            }
          />
        ))}
        {categories.length === 0 && <p className="text-sm text-navy-dark/60">{t("noCategories")}</p>}
      </div>
    </div>
  );
}

function NewCategoryForm({
  supabase,
  nextSortOrder,
  onCreated,
}: {
  supabase: ReturnType<typeof createClient>;
  nextSortOrder: number;
  onCreated: (c: ServiceCategoryRow) => void;
}) {
  const t = useTranslations("admin.catalog");
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const { data, error: err } = await supabase
      .from("service_categories")
      .insert({ name: { ar, en, fr } as LocalizedText, sort_order: nextSortOrder })
      .select("id, name, icon, sort_order, is_active")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(true);
      return;
    }
    onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border border-sky-light bg-base-soft p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("nameAr")}>
          <input dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={t("nameEn")}>
          <input value={en} onChange={(e) => setEn(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={t("nameFr")}>
          <input value={fr} onChange={(e) => setFr(e.target.value)} required className={inputCls} />
        </Field>
      </div>
      {error && <p className="text-xs text-red-700">{t("actionFailed")}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
      >
        {busy ? t("saving") : t("create")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-navy-dark/70">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CategorySection({
  category,
  services,
  locale,
  supabase,
  onCategoryChange,
  onServiceAdded,
  onServiceChange,
}: {
  category: ServiceCategoryRow;
  services: ServiceRow[];
  locale: "ar" | "en" | "fr";
  supabase: ReturnType<typeof createClient>;
  onCategoryChange: (patch: Partial<ServiceCategoryRow>) => void;
  onServiceAdded: (s: ServiceRow) => void;
  onServiceChange: (id: string, patch: Partial<ServiceRow>) => void;
}) {
  const t = useTranslations("admin.catalog");
  const [editing, setEditing] = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [names, setNames] = useState(category.name);
  const [busy, setBusy] = useState(false);

  async function saveCategory() {
    setBusy(true);
    const { error } = await supabase.from("service_categories").update({ name: names }).eq("id", category.id);
    setBusy(false);
    if (!error) {
      onCategoryChange({ name: names });
      setEditing(false);
    }
  }

  async function toggleActive() {
    const next = !category.is_active;
    onCategoryChange({ is_active: next });
    await supabase.from("service_categories").update({ is_active: next }).eq("id", category.id);
  }

  return (
    <section className={`rounded-2xl border border-sky-light p-4 ${!category.is_active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <input dir="rtl" value={names.ar} onChange={(e) => setNames({ ...names, ar: e.target.value })} className={inputCls} />
            <input value={names.en} onChange={(e) => setNames({ ...names, en: e.target.value })} className={inputCls} />
            <input value={names.fr} onChange={(e) => setNames({ ...names, fr: e.target.value })} className={inputCls} />
          </div>
        ) : (
          <h2 className="font-heading text-lg text-navy-dark">{category.name[locale] ?? category.name.en}</h2>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <button type="button" disabled={busy} onClick={saveCategory} className="rounded-full bg-navy px-3.5 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50">
              {t("save")}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-navy/20 px-3.5 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
              {t("edit")}
            </button>
          )}
          <button
            type="button"
            onClick={toggleActive}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              category.is_active ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-navy text-base hover:bg-navy-dark"
            }`}
          >
            {category.is_active ? t("deactivate") : t("activate")}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {services.map((s) => (
          <ServiceRowCard key={s.id} service={s} locale={locale} supabase={supabase} onChange={(patch) => onServiceChange(s.id, patch)} />
        ))}
        {services.length === 0 && <p className="text-sm text-navy-dark/50">{t("noServices")}</p>}
      </div>

      <button
        type="button"
        onClick={() => setShowNewService((s) => !s)}
        className="mt-3 rounded-full border border-navy/20 px-3.5 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale"
      >
        {showNewService ? t("cancel") : t("addService")}
      </button>

      {showNewService && (
        <NewServiceForm
          supabase={supabase}
          categoryId={category.id}
          nextSortOrder={services.length}
          onCreated={(s) => {
            onServiceAdded(s);
            setShowNewService(false);
          }}
        />
      )}
    </section>
  );
}

function NewServiceForm({
  supabase,
  categoryId,
  nextSortOrder,
  onCreated,
}: {
  supabase: ReturnType<typeof createClient>;
  categoryId: string;
  nextSortOrder: number;
  onCreated: (s: ServiceRow) => void;
}) {
  const t = useTranslations("admin.catalog");
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [price, setPrice] = useState("");
  const [fold, setFold] = useState(true);
  const [starch, setStarch] = useState(true);
  const [haute, setHaute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const { data, error: err } = await supabase
      .from("services")
      .insert({
        category_id: categoryId,
        name: { ar, en, fr } as LocalizedText,
        base_price: Number(price),
        requires_fold_option: fold,
        requires_starch_option: starch,
        is_haute_couture: haute,
        sort_order: nextSortOrder,
      })
      .select("id, category_id, name, description, base_price, requires_fold_option, requires_starch_option, is_haute_couture, is_active, sort_order, image_url")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(true);
      return;
    }
    onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-sky-light bg-base-soft p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label={t("nameAr")}>
          <input dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} required className={inputCls} placeholder={t("servicePlaceholderAr")} />
        </Field>
        <Field label={t("nameEn")}>
          <input value={en} onChange={(e) => setEn(e.target.value)} required className={inputCls} placeholder={t("servicePlaceholderEn")} />
        </Field>
        <Field label={t("nameFr")}>
          <input value={fr} onChange={(e) => setFr(e.target.value)} required className={inputCls} />
        </Field>
        <Field label={t("price")}>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required className={smallInputCls} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-navy-dark/80">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={fold} onChange={(e) => setFold(e.target.checked)} />
          {t("requiresFold")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={starch} onChange={(e) => setStarch(e.target.checked)} />
          {t("requiresStarch")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={haute} onChange={(e) => setHaute(e.target.checked)} />
          {t("hauteCouture")}
        </label>
      </div>

      {error && <p className="text-xs text-red-700">{t("actionFailed")}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50"
      >
        {busy ? t("saving") : t("create")}
      </button>
    </form>
  );
}

function ServiceRowCard({
  service,
  locale,
  supabase,
  onChange,
}: {
  service: ServiceRow;
  locale: "ar" | "en" | "fr";
  supabase: ReturnType<typeof createClient>;
  onChange: (patch: Partial<ServiceRow>) => void;
}) {
  const t = useTranslations("admin.catalog");
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState(service.name);
  const [price, setPrice] = useState(String(service.base_price));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("services")
      .update({ name: names, base_price: Number(price) })
      .eq("id", service.id);
    setBusy(false);
    if (!error) {
      onChange({ name: names, base_price: Number(price) });
      setEditing(false);
    }
  }

  async function toggleActive() {
    const next = !service.is_active;
    onChange({ is_active: next });
    await supabase.from("services").update({ is_active: next }).eq("id", service.id);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${service.id}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("service-images").upload(path, file, { upsert: true });
    if (!uploadErr) {
      const { data } = supabase.storage.from("service-images").getPublicUrl(path);
      const { error: updateErr } = await supabase.from("services").update({ image_url: data.publicUrl }).eq("id", service.id);
      if (!updateErr) onChange({ image_url: data.publicUrl });
    }
    setUploading(false);
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-light/70 bg-white px-3 py-2.5 ${!service.is_active ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <label className="relative shrink-0 cursor-pointer">
          {service.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.image_url} alt="" className="h-12 w-12 rounded-lg border border-sky-light object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-navy-dark/25 text-[10px] text-navy-dark/40">
              {uploading ? "…" : t("photo")}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
          />
        </label>

        {editing ? (
          <div className="grid flex-1 gap-2 sm:grid-cols-4">
            <input dir="rtl" value={names.ar} onChange={(e) => setNames({ ...names, ar: e.target.value })} className={inputCls} />
            <input value={names.en} onChange={(e) => setNames({ ...names, en: e.target.value })} className={inputCls} />
            <input value={names.fr} onChange={(e) => setNames({ ...names, fr: e.target.value })} className={inputCls} />
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={smallInputCls} />
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-navy-dark">{service.name[locale] ?? service.name.en}</p>
            <p className="text-xs text-navy-dark/60">${service.base_price.toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <button type="button" disabled={busy} onClick={save} className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-base hover:bg-navy-dark disabled:opacity-50">
            {t("save")}
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy-dark hover:bg-sky-pale">
            {t("edit")}
          </button>
        )}
        <button
          type="button"
          onClick={toggleActive}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            service.is_active ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-navy text-base hover:bg-navy-dark"
          }`}
        >
          {service.is_active ? t("deactivate") : t("activate")}
        </button>
      </div>
    </div>
  );
}
