// Whish Money payment-link adapter.
//
// IMPORTANT: the exact request/response contract below (path, header
// names, payload shape) is NOT verified against Whish Money's live
// merchant API docs from inside this environment — confirm it against
// your Whish merchant dashboard / integration guide before depending on
// it in production. Everything is centralized here so fixing the real
// contract later is a one-file change.
//
// Until WHISH_API_BASE_URL / WHISH_CHANNEL / WHISH_SECRET are set, this
// falls back to a local mock checkout so the rest of the order flow
// (creation, photo upload, payment confirmation) stays fully testable.

export type CreatePaymentLinkInput = {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreatePaymentLinkResult = {
  paymentUrl: string;
  providerReference: string;
  mocked: boolean;
};

export async function createWhishPaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult> {
  const apiBase = process.env.WHISH_API_BASE_URL;
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  const apiKey = process.env.WHISH_API_KEY;

  if (!apiBase || !channel || !secret || !apiKey) {
    return {
      paymentUrl: `/order/${input.orderId}/pay/mock`,
      providerReference: `MOCK-${input.orderId.slice(0, 8)}`,
      mocked: true,
    };
  }

  const res = await fetch(`${apiBase}/payment/link/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      channel,
      secret,
      apikey: apiKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency ?? "USD",
      invoice: input.orderNumber,
      successCallbackUrl: input.successUrl,
      failureCallbackUrl: input.cancelUrl,
    }),
  });

  if (!res.ok) {
    throw new Error(`Whish payment link creation failed (${res.status})`);
  }

  const data: { collectUrl?: string; paymentUrl?: string; reference?: string; transactionId?: string } =
    await res.json();

  const paymentUrl = data.collectUrl ?? data.paymentUrl;
  if (!paymentUrl) {
    throw new Error("Whish response did not include a payment URL");
  }

  return {
    paymentUrl,
    providerReference: data.reference ?? data.transactionId ?? "",
    mocked: false,
  };
}
