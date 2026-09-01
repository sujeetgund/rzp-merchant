import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { logAudit } from "@/lib/agent/audit";
import { fulfillOrderAndReduceInventory } from "@/lib/commerce/inventory";

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  error_description?: string | null;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let isValid: boolean;
  try {
    isValid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const body = JSON.parse(rawBody) as RazorpayWebhookBody;
  const payment = body.payload.payment?.entity;

  if (!payment) {
    return NextResponse.json({ received: true });
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.razorpayOrderId, payment.order_id))
    .limit(1);

  if (!order) {
    return NextResponse.json({ received: true });
  }

  if (body.event === "payment.captured" || body.event === "order.paid") {
    await fulfillOrderAndReduceInventory(order.id, payment.id);
  } else if (body.event === "payment.failed") {
    if (order.status !== "paid") {
      await db
        .update(orders)
        .set({
          status: "failed",
          failureReason: payment.error_description ?? "Payment failed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
      await logAudit({
        sessionId: order.sessionId,
        action: "PAYMENT_FAILED",
        input: { razorpayOrderId: payment.order_id, paymentId: payment.id },
        explanation: `Payment failed for order ${order.id}: ${
          payment.error_description ?? "unknown reason"
        }. No charge was made and the cart was preserved so the customer can retry.`,
        riskLevel: "MEDIUM",
      });
    }
  }

  return NextResponse.json({ received: true });
}
