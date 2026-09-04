import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

// Redirect target for both Google OAuth and the Supabase email-confirmation
// link — both hand back a PKCE `code` that must be exchanged for a real
// session server-side before the browser lands on a protected page. Kept
// outside app/[locale] (and excluded from proxy.ts's matcher) so the raw
// `code` reaches this handler before next-intl's locale routing touches it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const locale = searchParams.get("locale") || routing.defaultLocale;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Root "/" page does the role-based redirect (customer/staff/driver).
      return NextResponse.redirect(`${origin}/${locale}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=auth_failed`);
}
