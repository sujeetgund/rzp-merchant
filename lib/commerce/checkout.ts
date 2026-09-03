import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { getHydratedCart } from "@/lib/cart";
import { getRazorpay } from "@/lib/razorpay/client";
import { logAudit } from "@/lib/agent/audit";
import { evaluateCheckoutPolicy } from "@/lib/agent/policy";

export interface CheckoutResult {
  orderId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  amountInRupees: number; // in INR rupees
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
 * Merchant-side fraud/abuse checks (rate limiting, max order amount) applied
 * to the storefront checkout too — not just the MCP/ACP path. There's no
 * buyer mandate here (the human confirms the purchase themselves right in
 * the Checkout.js flow), so only hard violations block; the "requires human
 * confirmation" signal is meaningless when a human is already the one
 * confirming, and is intentionally ignored for this path.
 */
async function checkMerchantFraudSignals(
  sessionId: string,
  totalPaise: number,
  items: { name: string; quantity: number; price: number }[]
): Promise<{ error: string } | null> {
  const policy = await evaluateCheckoutPolicy({
    sessionId,
    totalInRupees: totalPaise / 100,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, priceInRupees: i.price / 100 })),
  });

  if (!policy.allowed) {
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: { violations: policy.violations },
      explanation: `Checkout blocked: ${policy.reason}`,
      riskLevel: policy.risk,
    });
    return { error: policy.reason };
  }
  return null;
}

/**
 * Creates (or idempotently reuses) a Razorpay order for the session's current cart.
 */
export async function createCheckoutForSession(sessionId: string, userId?: string): Promise<CheckoutOutcome> {
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
      output: {
        orderId: existing.id,
        razorpayOrderId: existing.razorpayOrderId,
        amountInRupees: existing.amount / 100,
        currency: existing.currency,
        reused: true,
      },
      explanation: `Reused pending checkout order for ₹${(existing.amount / 100).toFixed(2)} (idempotency).`,
    });
    return {
      orderId: existing.id,
      razorpayOrderId: existing.razorpayOrderId!,
      amount: existing.amount,
      amountInRupees: existing.amount / 100,
      currency: existing.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    };
  }

  const fraudCheck = await checkMerchantFraudSignals(sessionId, cart.total, cart.items);
  if (fraudCheck) return fraudCheck;

  let rzpOrder: { id: string };
  try {
    const razorpay = getRazorpay();
    rzpOrder = await razorpay.orders.create({
      amount: cart.total,
      currency: cart.currency,
      receipt: fingerprint,
      notes: { sessionId, type: "cart_checkout", userId: userId ?? "" },
    });
  } catch (err) {
    const description =
      (err as { error?: { description?: string } })?.error?.description ??
      (err as Error).message ??
      "Could not reach Razorpay";
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: { error: description, amountInRupees: cart.total / 100 },
      explanation: `Razorpay order creation failed: ${description}`,
      riskLevel: "MEDIUM",
    });
    return { error: `Payment provider error: ${description}` };
  }

  const [order] = await db
    .insert(orders)
    .values({
      sessionId,
      userId: userId ?? null,
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
    output: {
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amountInRupees: cart.total / 100,
      currency: cart.currency,
      itemCount: cart.items.length,
      items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, priceInRupees: i.price / 100 })),
    },
    explanation: `Created Razorpay checkout order for ₹${(cart.total / 100).toFixed(2)} covering ${cart.items.length} item(s).`,
    riskLevel: "MEDIUM",
  });

  return {
    orderId: order.id,
    razorpayOrderId: String(rzpOrder.id),
    amount: cart.total,
    amountInRupees: cart.total / 100,
    currency: cart.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  };
}

/**
 * Creates an instant "Buy Now" checkout for a specific product without modifying or emptying the customer's existing cart.
 */
export async function createDirectCheckoutForProduct(
  sessionId: string,
  productId: string,
  quantity = 1,
  variantId?: string,
  userId?: string
): Promise<CheckoutOutcome> {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  if (!product) {
    return { error: "Product not found." };
  }
  if (product.inventory < quantity) {
    return { error: `Only ${product.inventory} unit(s) of ${product.name} left in stock.` };
  }

  const totalAmount = product.price * quantity; // in paise
  const fingerprint = fingerprintFor(sessionId, [{ productId, variantId, quantity }]);

  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, fingerprint))
    .limit(1);

  if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: {
        orderId: existing.id,
        razorpayOrderId: existing.razorpayOrderId,
        directBuy: true,
        amountInRupees: existing.amount / 100,
        reused: true,
      },
      explanation: `Reused pending Buy Now order for ${product.name} (idempotency).`,
    });
    return {
      orderId: existing.id,
      razorpayOrderId: existing.razorpayOrderId!,
      amount: existing.amount,
      amountInRupees: existing.amount / 100,
      currency: existing.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    };
  }

  const fraudCheck = await checkMerchantFraudSignals(sessionId, totalAmount, [
    { name: product.name, quantity, price: product.price },
  ]);
  if (fraudCheck) return fraudCheck;

  let rzpOrder: { id: string };
  try {
    const razorpay = getRazorpay();
    rzpOrder = await razorpay.orders.create({
      amount: totalAmount,
      currency: "INR",
      receipt: fingerprint,
      notes: { sessionId, type: "direct_buy_now", productId, userId: userId ?? "" },
    });
  } catch (err) {
    const description =
      (err as { error?: { description?: string } })?.error?.description ??
      (err as Error).message ??
      "Could not reach Razorpay";
    await logAudit({
      sessionId,
      action: "CREATE_CHECKOUT",
      output: { error: description, directBuy: true, productId, productName: product.name },
      explanation: `Direct Buy Now failed for ${product.name}: ${description}`,
      riskLevel: "MEDIUM",
    });
    return { error: `Payment provider error: ${description}` };
  }

  const [order] = await db
    .insert(orders)
    .values({
      sessionId,
      userId: userId ?? null,
      razorpayOrderId: String(rzpOrder.id),
      amount: totalAmount,
      currency: "INR",
      status: "created",
      idempotencyKey: fingerprint,
    })
    .returning();

  await db.insert(orderItems).values([
    {
      orderId: order.id,
      productId: product.id,
      variantId: variantId ?? null,
      quantity,
      price: product.price,
    },
  ]);

  await logAudit({
    sessionId,
    action: "CREATE_CHECKOUT",
    output: {
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      directBuy: true,
      amountInRupees: totalAmount / 100,
      currency: "INR",
      productName: product.name,
      quantity,
    },
    explanation: `Instant Buy Now created for ${quantity} x ${product.name} (₹${(totalAmount / 100).toFixed(2)}) without altering cart.`,
    riskLevel: "MEDIUM",
  });

  return {
    orderId: order.id,
    razorpayOrderId: String(rzpOrder.id),
    amount: totalAmount,
    amountInRupees: totalAmount / 100,
    currency: "INR",
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  };
}
