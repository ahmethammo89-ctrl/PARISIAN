import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

// Path prefixes (locale already stripped) that require a signed-in user.
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/driver", "/order"];
const AUTH_PREFIXES = ["/login", "/verify"];

export default async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  // next-intl already issued a locale redirect (e.g. "/" -> "/ar") — let it
  // through, auth is re-checked on the follow-up request anyway.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  const { response, user } = await updateSession(request, intlResponse);

  const locale = request.nextUrl.pathname.split("/")[1] || routing.defaultLocale;
  const pathWithoutLocale = request.nextUrl.pathname.replace(`/${locale}`, "") || "/";

  const isProtected = PROTECTED_PREFIXES.some((p) => pathWithoutLocale.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathWithoutLocale.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", pathWithoutLocale);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  // "auth" excluded so /auth/callback (Google OAuth + email-confirmation
  // redirect target) reaches its Route Handler with an untouched URL —
  // next-intl would otherwise try to locale-prefix it before the `code`
  // exchange ever runs.
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
