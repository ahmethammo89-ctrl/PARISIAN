import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client — bypasses RLS entirely. Server-only (the
 * "server-only" import makes any accidental client-bundle import a
 * build error), and only for the handful of writes that must happen
 * on the system's authority rather than the signed-in user's, e.g.
 * creating/settling a `payments` row after this Route Handler has
 * already verified the requesting user owns the order. Every call site
 * must do its own authorization check first — this client does none.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
