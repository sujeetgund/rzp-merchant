"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/storefront/CartContext";
import { formatPaise } from "@/lib/format";
import { openRazorpayCheckout, verifyPaymentOnServer } from "@/lib/razorpay/checkoutClient";
import { useSession } from "@/lib/auth/auth-client";
import { AuthModal } from "@/components/auth/AuthModal";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, refresh } = useCart();
  const { data: session } = useSession();
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  async function handleCheckout() {
    if (!session?.user) {
      setAuthModalOpen(true);
      return;
    }

    setCheckingOut(true);
    try {
      const res = await fetch("/api/razorpay/order", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAuthModalOpen(true);
        } else {
          gooeyToast.error(data.error ?? "Could not start checkout");
        }
        setCheckingOut(false);
        return;
      }
      if (!data.keyId) {
        gooeyToast.error("Razorpay key not configured. Add NEXT_PUBLIC_RAZORPAY_KEY_ID to .env.");
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
            gooeyToast.error("Payment could not be verified. Please contact support.");
            setCheckingOut(false);
            return;
          }
          await refresh();
          router.push(`/order/${data.orderId}`);
        },
        onFailure: (description) => {
          setCheckingOut(false);
          gooeyToast.error(`Payment failed: ${description}`);
        },
        onDismiss: () => setCheckingOut(false),
      });
    } catch {
      gooeyToast.error("Something went wrong starting checkout.");
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
    <>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Your Cart</h1>
        <div className="divide-y rounded-xl border bg-card shadow-2xs">
          {cart.items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId ?? ""}`}
              className="flex items-center gap-4 p-4"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatPaise(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-xs font-mono font-bold tabular-nums">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={item.quantity >= item.inventory}
                  onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              <p className="w-20 text-right text-sm font-mono font-bold tabular-nums">{formatPaise(item.lineTotal)}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeItem(item.productId, item.variantId)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <span className="text-base font-semibold">Total</span>
          <span className="text-lg font-bold font-mono tabular-nums">{formatPaise(cart.total)}</span>
        </div>

        <Button className="mt-4 w-full font-semibold" size="lg" disabled={checkingOut} onClick={handleCheckout}>
          {checkingOut ? "Opening Razorpay..." : "Proceed to Checkout"}
        </Button>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign In to Checkout"
        description="Please sign in or create an account to proceed with cart checkout."
        onSuccess={() => handleCheckout()}
      />
    </>
  );
}
