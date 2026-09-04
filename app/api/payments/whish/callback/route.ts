import { NextResponse } from "next/server";

/**
 * Browser return-trip target after a real Whish Money checkout
 * (success or cancel). This only redirects the shopper back to the
 * order page with a status flag for the UI to read — it does NOT mark
 * anything as paid. Whish's actual payment confirmation must arrive
 * through a server-to-server webhook verified against their real
 * signature/contract (not implemented — the exact contract wasn't
 * available to verify in this environment). Add that webhook handler
 * here before relying on this integration for real payments.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const status = url.searchParams.get("status") ?? "unknown";

  const redirectUrl = new URL(`/order/${orderId}/pay`, url.origin);
  redirectUrl.searchParams.set("whish", status);
  return NextResponse.redirect(redirectUrl);
}
