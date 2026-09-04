import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Client-side Supabase instance (uses the anon key; every read/write is
// still gated by Postgres RLS policies from Step 1). Used by client
// components — e.g. the OTP login/verify forms.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
