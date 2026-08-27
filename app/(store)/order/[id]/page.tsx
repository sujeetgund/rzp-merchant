import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ params }: OrderPageProps) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();

  const items = await db
    .select({
      quantity: orderItems.quantity,
      price: orderItems.price,
      name: products.name,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));

  const statusDisplay = {
    paid: { icon: CheckCircle2, label: "Payment successful", color: "text-emerald-600" },
    failed: { icon: XCircle, label: "Payment failed", color: "text-destructive" },
    created: { icon: Clock, label: "Waiting for payment confirmation", color: "text-amber-600" },
    authorized: { icon: Clock, label: "Payment authorized", color: "text-amber-600" },
    cancelled: { icon: XCircle, label: "Order cancelled", color: "text-muted-foreground" },
  }[order.status];

  const Icon = statusDisplay.icon;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Icon className={`mx-auto size-12 ${statusDisplay.color}`} />
      <h1 className="mt-4 text-2xl font-semibold">{statusDisplay.label}</h1>
      <p className="mt-1 text-muted-foreground">Order #{order.id.slice(0, 8)}</p>

      <div className="mt-6 rounded-lg border bg-background p-4 text-left">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between py-1 text-sm">
            <span>
              {item.quantity} x {item.name}
            </span>
            <span>{formatPaise(item.price * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{formatPaise(order.amount)}</span>
        </div>
      </div>

      {order.status === "failed" && (
        <p className="mt-4 text-sm text-muted-foreground">
          No charge was made and your cart was preserved — you can retry checkout anytime.
        </p>
      )}

      <Button render={<Link href="/" />} nativeButton={false} className="mt-6">
        Continue shopping
      </Button>
    </div>
  );
}
