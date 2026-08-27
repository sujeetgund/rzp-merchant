"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/storefront/CartContext";
import { formatPaise } from "@/lib/format";
import { openRazorpayCheckout, verifyPaymentOnServer } from "@/lib/razorpay/checkoutClient";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, refresh } = useCart();
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/razorpay/order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start checkout");
        setCheckingOut(false);
        return;
      }
      if (!data.keyId) {
        toast.error("Razorpay key not configured. Add NEXT_PUBLIC_RAZORPAY_KEY_ID to .env.");
        setCheckingOut(false);
        return;
      }
      await openRazorpayCheckout({
        keyId: data.keyId,
        amount: data.amount,
        currency: data.currency,
        razorpayOrderId: data.razorpayOrderId,
        onSuccess: async (payload) => {
          const verified = await verifyPaymentOnServer(payload);
          if (!verified) {
            toast.error("Payment could not be verified. Please contact support.");
            setCheckingOut(false);
            return;
          }
          await refresh();
          router.push(`/order/${data.orderId}`);
        },
        onFailure: (description) => {
          setCheckingOut(false);
          toast.error(`Payment failed: ${description}`);
        },
        onDismiss: () => setCheckingOut(false),
      });
    } catch {
      toast.error("Something went wrong starting checkout.");
      setCheckingOut(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button render={<Link href="/" />} nativeButton={false} className="mt-4">
          Continue shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Your Cart</h1>
      <div className="divide-y rounded-lg border bg-background">
        {cart.items.map((item) => (
          <div
            key={`${item.productId}-${item.variantId ?? ""}`}
            className="flex items-center gap-4 p-4"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl && (
                <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">{formatPaise(item.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={item.quantity >= item.inventory}
                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <p className="w-20 text-right text-sm font-medium">{formatPaise(item.lineTotal)}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(item.productId, item.variantId)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-lg font-medium">Total</span>
        <span className="text-lg font-semibold">{formatPaise(cart.total)}</span>
      </div>

      <Button className="mt-4 w-full" size="lg" disabled={checkingOut} onClick={handleCheckout}>
        {checkingOut ? "Opening Razorpay..." : "Proceed to Checkout"}
      </Button>
    </div>
  );
}
