import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentActor, ADMIN_ROLES } from "@/lib/supabase/guards";
import type { UserRole, ProfileRow } from "@/types/database";

const CREATABLE_ROLES: UserRole[] = ["driver", "staff", "admin", "super_admin"];

// Admin/super_admin only. Lists every non-customer account (staff,
// drivers, admins) — customers are excluded, this page is for managing
// the team, not the customer base.
export async function GET() {
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, branch_id, is_active, created_at")
    .neq("role", "customer")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  return NextResponse.json({ users: data });
}

// Creates a real account (staff/driver/admin) directly — no self-signup
// needed. Uses the service-role Admin API to create the auth.users row
// (email_confirm: true, so it's usable immediately), then the
// auto-provisioning trigger creates the `profiles` row, which we patch
// with the requested role/name/branch right after.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const newRole = body?.role as UserRole | undefined;
  const branchId = typeof body?.branchId === "string" && body.branchId ? body.branchId : null;
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;

  if (!email || !password || !fullName || !newRole || !CREATABLE_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(phone ? { phone_confirm: false } : {}),
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      console.error("[admin/users] createUser failed:", createError?.message, createError);
      const code = createError?.message?.toLowerCase().includes("already") ? "email_in_use" : "create_failed";
      return NextResponse.json({ error: code, detail: createError?.message ?? null }, { status: 409 });
    }

    const patch: Partial<ProfileRow> = { full_name: fullName, role: newRole, branch_id: branchId };
    if (phone) patch.phone = phone;

    const { error: profileError } = await admin.from("profiles").update(patch).eq("id", created.user.id);
    if (profileError) {
      console.error("[admin/users] profile patch failed:", profileError.message, profileError);
      return NextResponse.json({ error: "profile_update_failed", detail: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ id: created.user.id });
  } catch (err) {
    // Most common cause: SUPABASE_SERVICE_ROLE_KEY missing/wrong in this
    // environment's env vars — createAdminClient() throws synchronously
    // in that case, before any Supabase call is even made.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[admin/users] unexpected error:", detail, err);
    return NextResponse.json({ error: "create_failed", detail }, { status: 500 });
  }
}
