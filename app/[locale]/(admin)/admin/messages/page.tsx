import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";

export default async function AdminMessagesPage() {
  const t = await getTranslations("admin.messages");
  const supabase = await createClient();

  // Most recent 300 messages across all threads, newest first — enough to
  // surface every customer with a recent conversation without a bespoke
  // "group by customer" query. Dedupe client-side, keeping each
  // customer's latest message as the preview.
  const { data: recent } = await supabase
    .from("support_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const seen = new Set<string>();
  const latestByCustomer = (recent ?? []).filter((m) => {
    if (seen.has(m.customer_id)) return false;
    seen.add(m.customer_id);
    return true;
  });

  const customerIds = latestByCustomer.map((m) => m.customer_id);
  const { data: profiles } = customerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl text-navy-dark sm:text-3xl">{t("title")}</h1>

      {latestByCustomer.length === 0 && <p className="mt-6 text-sm text-navy-dark/60">{t("empty")}</p>}

      <div className="mt-6 space-y-2">
        {latestByCustomer.map((m) => {
          const p = profileMap.get(m.customer_id);
          return (
            <Link
              key={m.customer_id}
              href={`/admin/messages/${m.customer_id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-sky-light bg-base-soft p-4 transition-colors hover:border-sky"
            >
              <div className="min-w-0">
                <p className="font-medium text-navy-dark">{p?.full_name || p?.phone || m.customer_id}</p>
                <p className="mt-0.5 truncate text-sm text-navy-dark/60">{m.audio_path ? t("voiceMessage") : m.body}</p>
              </div>
              <span className="shrink-0 text-xs text-navy/60">
                {new Date(m.created_at).toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
