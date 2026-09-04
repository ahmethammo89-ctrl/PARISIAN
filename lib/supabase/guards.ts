import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Resolves the caller + role once, for Route Handlers that need a staff/driver check before touching business tables (RLS is still the real backstop — this just gives callers a clean 401/403 instead of a confusing RLS-denied write). */
export async function currentActor(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { user, role: profile?.role ?? null } as const;
}

export const STAFF_ROLES = ["staff", "admin", "super_admin"];

/** Only these may create accounts or change roles — plain `staff` cannot. */
export const ADMIN_ROLES = ["admin", "super_admin"];
