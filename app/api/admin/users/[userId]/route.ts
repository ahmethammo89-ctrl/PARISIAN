import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentActor, ADMIN_ROLES } from "@/lib/supabase/guards";
import type { UserRole, ProfileRow } from "@/types/database";

const ASSIGNABLE_ROLES: UserRole[] = ["driver", "staff", "admin", "super_admin"];

// Admin/super_admin only. Changes an existing staff/driver/admin
// account's role, branch, or active flag. Self-role-change is blocked
// so an admin can never accidentally lock themselves out; deactivating
// your own account is blocked for the same reason.
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { user, role } = await currentActor(supabase);
  if (!user || !role || !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const patch: Partial<ProfileRow> = {};

  if (body?.role !== undefined) {
    if (userId === user.id) {
      return NextResponse.json({ error: "cannot_change_own_role" }, { status: 400 });
    }
    const newRole = body.role as UserRole;
    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }
    patch.role = newRole;
  }

  if (body?.branchId !== undefined) {
    patch.branch_id = body.branchId || null;
  }

  if (body?.isActive !== undefined) {
    if (userId === user.id) {
      return NextResponse.json({ error: "cannot_deactivate_self" }, { status: 400 });
    }
    patch.is_active = Boolean(body.isActive);
  }

  if (body?.fullName !== undefined) {
    patch.full_name = typeof body.fullName === "string" ? body.fullName.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) {
      console.error("[admin/users/:id] update failed:", error.message, error);
      return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[admin/users/:id] unexpected error:", detail, err);
    return NextResponse.json({ error: "update_failed", detail }, { status: 500 });
  }
}
