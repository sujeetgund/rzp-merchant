import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { clearCart } from "@/lib/cart";
import { logAudit } from "@/lib/agent/audit";

/**
 * Fulfills a paid order: updates status to 'paid', deducts stock for each item from `products.inventory` in Postgres,
 * clears the customer's cart, and logs audit telemetry.
 */
export async function fulfillOrderAndReduceInventory(
  orderId: string,
  razorpayPaymentId: string
): Promise<boolean> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) return false;
  if (order.status === "paid") return true; // Already processed idempotently

  // 1. Update order status to paid
  await db
    .update(orders)
    .set({
      status: "paid",
      razorpayPaymentId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // 2. Fetch items for this order and decrement stock in Postgres
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  const stockAdjustments: { productName: string; qty: number; remainingStock: number }[] = [];

  for (const item of items) {
    const [updatedProduct] = await db
      .update(products)
      .set({
        inventory: sql`GREATEST(0, ${products.inventory} - ${item.quantity})`,
      })
      .where(eq(products.id, item.productId))
      .returning();

    if (updatedProduct) {
      stockAdjustments.push({
        productName: updatedProduct.name,
        qty: item.quantity,
        remainingStock: updatedProduct.inventory,
      });
    }
  }

  // 3. Clear session cart
  await clearCart(order.sessionId);

  // 4. Log audit log for payment capture & stock deduction
  await logAudit({
    sessionId: order.sessionId,
    action: "PAYMENT_CAPTURED",
    input: { orderId: order.id, razorpayOrderId: order.razorpayOrderId, paymentId: razorpayPaymentId },
    output: {
      amountInRupees: order.amount / 100,
      currency: order.currency,
      stockAdjustments,
    },
    explanation: `Payment verified for order ${order.id} (₹${(order.amount / 100).toFixed(2)}). Stock decremented for ${items.length} item(s) and cart cleared.`,
    riskLevel: "LOW",
  });

  return true;
}
