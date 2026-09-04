import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/supabase/guards";
import UsersClient from "./UsersClient";

// Extra gate on top of the (admin) layout's staff-only check: plain
// `staff` can see orders/scan but not the Users page — only
// admin/super_admin manage accounts.
export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return;
  }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !ADMIN_ROLES.includes(me.role)) {
    redirect({ href: "/admin/dashboard", locale });
    return;
  }

  const [{ data: users }, { data: branches }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role, branch_id, is_active, created_at")
      .neq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name").eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <UsersClient initialUsers={users ?? []} branches={branches ?? []} currentUserId={user.id} />
    </div>
  );
}
