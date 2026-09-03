import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutSessions, products } from "@/lib/db/schema";
import { logAudit } from "@/lib/agent/audit";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function serialize(cs: typeof checkoutSessions.$inferSelect) {
  return {
    id: cs.id,
    status: cs.status,
    items: cs.items,
    amountINR: cs.amount / 100,
    currency: cs.currency,
    buyerMandate: cs.buyerMandate,
    razorpayOrderId: cs.razorpayOrderId,
    paymentLink: cs.paymentLink,
    createdAt: cs.createdAt,
    expiresAt: cs.expiresAt,
  };
}

/** Get checkout session status — the ACP "poll for state" endpoint. */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
  if (!cs) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  return NextResponse.json(serialize(cs));
}

const patchSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
});

/** Update the item list on a still-open checkout session (add/remove items before completion). */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
  if (!cs) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  if (cs.status !== "DRAFT" && cs.status !== "PAUSED_MANDATE_EXCEEDED") {
    return NextResponse.json(
      { error: `Cannot modify a checkout session in status ${cs.status}.` },
      { status: 409 }
    );
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const productIds = parsed.data.items.map((i) => i.productId);
  const rows = await db.select().from(products).where(inArray(products.id, productIds));
  const byId = new Map(rows.map((p) => [p.id, p]));

  const missing = productIds.find((pid) => !byId.has(pid));
  if (missing) {
    return NextResponse.json({ error: `Product not found: ${missing}` }, { status: 400 });
  }

  const items = parsed.data.items.map((i) => {
    const product = byId.get(i.productId)!;
    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: i.quantity,
      imageUrl: product.imageUrl,
    };
  });
  const amount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const [updated] = await db
    .update(checkoutSessions)
    .set({ items, amount, status: "DRAFT" })
    .where(eq(checkoutSessions.id, id))
    .returning();

  await logAudit({
    sessionId: cs.sessionId,
    action: "MCP_UPDATE_CHECKOUT_SESSION",
    input: parsed.data,
    output: { checkoutSessionId: id, amountINR: amount / 100, itemCount: items.length },
    explanation: `Checkout session ${id} items updated: ${items.length} item(s), new total ₹${(amount / 100).toFixed(2)}.`,
  });

  return NextResponse.json(serialize(updated));
}

/** Cancel a checkout session. */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
  if (!cs) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  if (cs.status === "PAID") {
    return NextResponse.json({ error: "Cannot cancel a checkout session that has already been paid." }, { status: 409 });
  }

  const [updated] = await db
    .update(checkoutSessions)
    .set({ status: "CANCELLED" })
    .where(eq(checkoutSessions.id, id))
    .returning();

  await logAudit({
    sessionId: cs.sessionId,
    action: "MCP_CANCEL_CHECKOUT_SESSION",
    output: { checkoutSessionId: id },
    explanation: `Checkout session ${id} cancelled.`,
  });

  return NextResponse.json(serialize(updated));
}
