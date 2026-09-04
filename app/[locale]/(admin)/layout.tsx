import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";
import NewOrderAlert from "@/components/NewOrderAlert";

const STAFF_ROLES = ["staff", "admin", "super_admin"];

export default async function AdminLayout({
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect({ href: "/", locale });
    return;
  }

  return (
    <div>
      <NewOrderAlert />
      <AdminNav role={profile.role} />
      {children}
    </div>
  );
}
