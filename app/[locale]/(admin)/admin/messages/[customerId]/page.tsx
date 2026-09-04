import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import SupportChat from "@/components/SupportChat";

export default async function AdminMessageThreadPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const t = await getTranslations("admin.messages");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: viewerProfile }, { data: customer }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("profiles").select("full_name, phone").eq("id", customerId).single(),
    supabase.from("support_messages").select("*").eq("customer_id", customerId).order("created_at"),
  ]);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin/messages" className="text-sm text-navy hover:underline">
        {t("backToList")}
      </Link>
      <h1 className="font-heading mt-2 mb-6 text-2xl text-navy-dark">{customer.full_name || customer.phone}</h1>

      <SupportChat
        customerId={customerId}
        currentUserId={user.id}
        senderRole={viewerProfile?.role ?? "staff"}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
