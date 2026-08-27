"use client";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Client-only"));
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface RazorpaySuccessPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface OpenCheckoutParams {
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  name?: string;
  description?: string;
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  onFailure: (description: string) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(params: OpenCheckoutParams): Promise<void> {
  await loadCheckoutScript();

  interface RazorpayInstance {
    open: () => void;
    on: (event: string, handler: (response: unknown) => void) => void;
  }
  interface RazorpayConstructor {
    new (options: Record<string, unknown>): RazorpayInstance;
  }
  const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

  const rzp = new Razorpay({
    key: params.keyId,
    amount: params.amount,
    currency: params.currency,
    order_id: params.razorpayOrderId,
    name: params.name ?? "rzp Merchant",
    description: params.description ?? "Order payment",
    theme: { color: "#171717" },
    modal: {
      ondismiss: () => params.onDismiss?.(),
    },
    handler: (response: unknown) => {
      const payload = response as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };
      params.onSuccess({
        razorpayOrderId: payload.razorpay_order_id,
        razorpayPaymentId: payload.razorpay_payment_id,
        razorpaySignature: payload.razorpay_signature,
      });
    },
  });

  rzp.on("payment.failed", (response: unknown) => {
    const description =
      (response as { error?: { description?: string } })?.error?.description ?? "Payment failed";
    params.onFailure(description);
  });

  rzp.open();
}

/** Confirms a Checkout.js success payload with the server before trusting it. */
export async function verifyPaymentOnServer(payload: RazorpaySuccessPayload): Promise<boolean> {
  const res = await fetch("/api/razorpay/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: payload.razorpayOrderId,
      razorpay_payment_id: payload.razorpayPaymentId,
      razorpay_signature: payload.razorpaySignature,
    }),
  });
  return res.ok;
}
