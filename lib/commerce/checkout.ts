import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { getHydratedCart } from "@/lib/cart";
import { getRazorpay } from "@/lib/razorpay/client";
import { logAudit } from "@/lib/agent/audit";

export interface CheckoutResult {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string | undefined;
}

export type CheckoutOutcome = CheckoutResult | { error: string };

function fingerprintFor(sessionId: string, items: { productId: string; variantId?: string; quantity: number }[]) {
  return crypto
    .createHash("sha256")
    .update(
      sessionId +
        JSON.stringify(
          [...items]
            .map((i) => ({ p: i.productId, v: i.variantId ?? null, q: i.quantity }))
            .sort((a, b) => a.p.localeCompare(b.p))
        )
    )
    .digest("hex")
    .slice(0, 40);
}

/**
 * Creates (or idempotently reuses) a Razorpay order for the session's
 * current cart. Shared by the AI agent's create_checkout tool and the
 * traditional storefront's checkout button, so both paths behave
 * identically and never double-charge a retried checkout.
 */
export async function createCheckoutForSession(sessionId: string): Promise<CheckoutOutcome> {
  const cart = await getHydratedCart(sessionId);

  if (cart.items.length === 0) {
    return { error: "Cart is empty. Add items before checking out." };
  }
  for (const item of cart.items) {
    if (item.quantity > item.inventory) {
      return {
        error: `Only ${item.inventory} unit(s) of ${item.name} left in stock. Please adjust quantity.`,
      };
    }
  }

  const fingerprint = fingerprintFor(sessionId, cart.items);

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, fingerprint))
    .limit(1);

  if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: { orderId: existing.id, reused: true },
      explanation: "Reused an existing pending checkout for this exact cart (idempotency).",
    });
    return {
      orderId: existing.id,
      razorpayOrderId: existing.razorpayOrderId!,
      amount: existing.amount,
      currency: existing.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    };
  }

  let rzpOrder: { id: string };
  try {
    const razorpay = getRazorpay();
    rzpOrder = await razorpay.orders.create({
      amount: cart.total,
      currency: cart.currency,
      receipt: fingerprint,
      notes: { sessionId },
    });
  } catch (err) {
    const description =
      (err as { error?: { description?: string } })?.error?.description ??
      (err as Error).message ??
      "Could not reach Razorpay";
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: { error: description },
      explanation: `Razorpay order creation failed: ${description}`,
      riskLevel: "MEDIUM",
    });
    return { error: `Payment provider error: ${description}` };
  }

  const [order] = await db
    .insert(orders)
    .values({
      sessionId,
      razorpayOrderId: String(rzpOrder.id),
      amount: cart.total,
      currency: cart.currency,
      status: "created",
      idempotencyKey: fingerprint,
    })
    .returning();

  await db.insert(orderItems).values(
    cart.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      price: item.price,
    }))
  );

  await logAudit({
    sessionId,
    action: "CREATE_CHECKOUT",
    output: { orderId: order.id, razorpayOrderId: rzpOrder.id, amount: cart.total },
    explanation: `Created Razorpay order for ₹${(cart.total / 100).toFixed(2)} covering ${cart.items.length} item(s).`,
    riskLevel: "MEDIUM",
  });

  return {
    orderId: order.id,
    razorpayOrderId: String(rzpOrder.id),
    amount: cart.total,
    currency: cart.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  };
}
