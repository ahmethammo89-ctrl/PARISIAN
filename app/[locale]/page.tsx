import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const ROLE_HOME: Record<UserRole, string> = {
  customer: "/dashboard",
  driver: "/driver/dashboard",
  staff: "/admin/dashboard",
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
};

export default async function RootPage({
  params,
}: {
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

  redirect({ href: ROLE_HOME[profile?.role ?? "customer"], locale });
}
