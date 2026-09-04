import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { LocalizedText } from "@/types/database";
import PrintButton from "./PrintButton";

export default async function TagsPage({ params }: { params: Promise<{ orderId: string; locale: string }> }) {
  const { orderId, locale } = await params;
  const supabase = await createClient();
  const t = await getTranslations("admin.tags");

  const { data: order } = await supabase.from("orders").select("order_number").eq("id", orderId).single();
  if (!order) notFound();

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId).order("item_index");
  const serviceIds = [...new Set((items ?? []).map((i) => i.service_id))];
  const { data: services } = serviceIds.length
    ? await supabase.from("services").select("id, name").in("id", serviceIds)
    : { data: [] };

  const tags = await Promise.all(
    (items ?? []).map(async (item) => ({
      item,
      serviceName: (services ?? []).find((s) => s.id === item.service_id)?.name as LocalizedText | undefined,
      qr: await QRCode.toDataURL(item.barcode, { margin: 1, width: 220 }),
    }))
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="font-heading text-2xl text-navy-dark">
          {t("title")} — {order.order_number}
        </h1>
        <PrintButton label={t("print")} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tags.map(({ item, serviceName, qr }) => (
          <div key={item.id} className="flex flex-col items-center rounded-2xl border-2 border-dashed border-sky-light p-3 text-center break-inside-avoid">
            <p className="font-heading text-xs text-navy-dark">{locale === "ar" ? "المصبغة الباريسية" : "Parisian Laundry"}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={item.barcode} className="my-2 h-24 w-24" />
            <p className="font-mono text-[11px] font-semibold text-navy-dark">{item.barcode}</p>
            <p className="mt-1 truncate text-[11px] text-navy/70">{serviceName?.[locale as "ar" | "en" | "fr"] ?? serviceName?.en}</p>
            <p className="text-[10px] text-navy/50">{order.order_number} · #{item.item_index}</p>
          </div>
        ))}
      </div>

      {tags.length === 0 && <p className="py-12 text-center text-sm text-navy/60">{t("empty")}</p>}
    </div>
  );
}
