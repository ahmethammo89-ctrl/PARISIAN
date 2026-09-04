import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Any role can view their own account area except pure staff-only roles
  // are sent to their own dashboards instead.
  if (profile?.role && profile.role !== "customer") {
    redirect({ href: "/", locale });
  }

  return children;
}
