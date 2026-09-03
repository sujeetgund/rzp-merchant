import Razorpay from "razorpay";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (instance) return instance;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Add your test-mode keys to .env."
    );
  }
  instance = new Razorpay({ key_id, key_secret });
  return instance;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not set. Add it to .env.");
  }
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}

/**
 * Verifies the signature Razorpay Checkout.js returns to the browser after a
 * successful payment (HMAC of `orderId|paymentId` using the account's key
 * secret — NOT the webhook secret). This is what actually confirms payment
 * in local/dev environments, since Razorpay webhooks require a publicly
 * reachable URL and won't reach localhost.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not set. Add it to .env.");
  }
  return Razorpay.validateWebhookSignature(
    `${razorpayOrderId}|${razorpayPaymentId}`,
    signature,
    secret
  );
}

/**
 * Verifies the signature Razorpay appends to the `callback_url` redirect
 * after a customer pays via a hosted Payment Link. This is the only local
 * dev-reachable confirmation for the ACP payment-link flow (Act 3) — the
 * page a human lands back on after paying has no Checkout.js `handler` to
 * call, since payment happened entirely on Razorpay's hosted page, and the
 * real webhook can't reach localhost either.
 */
export function verifyPaymentLinkSignature(params: {
  paymentLinkId: string;
  paymentLinkReferenceId: string;
  paymentLinkStatus: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not set. Add it to .env.");
  }
  const payload = `${params.paymentLinkId}|${params.paymentLinkReferenceId}|${params.paymentLinkStatus}|${params.paymentId}`;
  return Razorpay.validateWebhookSignature(payload, params.signature, secret);
}
