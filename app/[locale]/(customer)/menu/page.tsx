import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import type { LocalizedText } from "@/types/database";

export default async function MenuPage() {
  const t = await getTranslations("menu");
  const to = await getTranslations("order");
  const locale = (await getLocale()) as "ar" | "en" | "fr";
  const supabase = await createClient();

  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl text-navy-dark sm:text-3xl">{t("title")}</h1>
        <Link href="/order/new" className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-base hover:bg-navy-dark">
          {to("title")}
        </Link>
      </div>

      <div className="space-y-8">
        {(categories ?? []).map((cat) => {
          const catServices = (services ?? []).filter((s) => s.category_id === cat.id);
          if (catServices.length === 0) return null;
          const name = cat.name as LocalizedText;
          return (
            <section key={cat.id}>
              <h2 className="font-heading mb-3 text-lg text-navy-dark">{name[locale] ?? name.en}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {catServices.map((service) => {
                  const sName = service.name as LocalizedText;
                  return (
                    <div key={service.id} className="flex items-center gap-3 rounded-xl border border-sky-light bg-base-soft px-4 py-3">
                      {service.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={service.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-sky-light object-cover" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-navy-dark">
                          {sName[locale] ?? sName.en}
                          {service.is_haute_couture && (
                            <span className="ms-2 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base">
                              {to("services.haute")}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-sky">{formatPrice(service.base_price, locale)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {(categories ?? []).length === 0 && <p className="text-sm text-navy-dark/60">{t("empty")}</p>}
      </div>
    </div>
  );
}
