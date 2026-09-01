"use client";

import { useState, useTransition } from "react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Check, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/components/storefront/CartContext";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";
import type { Product } from "@/lib/db/schema";
import { openRazorpayCheckout, verifyPaymentOnServer } from "@/lib/razorpay/checkoutClient";

export function ProductDetailActions({ product }: { product: Product }) {
  const { addItem, cart } = useCart();
  const { open } = useAIDrawer();
  const [pending, startTransition] = useTransition();
  const [buying, setBuying] = useState(false);
  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);

  const outOfStock = product.inventory === 0;
  const isInCart = cart.items.some((i) => i.productId === product.id);

  const handleBuyNow = async () => {
    if (buying || outOfStock) return;
    setBuying(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1, variantId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        gooeyToast.error(data.error ?? "Failed to initialize Buy Now checkout.");
        setBuying(false);
        return;
      }

      openRazorpayCheckout({
        keyId: data.keyId,
        amount: data.amount,
        currency: data.currency,
        razorpayOrderId: data.razorpayOrderId,
        name: product.name,
        onSuccess: async (payload) => {
          const verified = await verifyPaymentOnServer(payload);
          setBuying(false);
          if (verified) {
            gooeyToast.success("Order paid successfully!");
            window.location.href = `/order/${data.orderId}`;
          }
        },
        onFailure: (desc) => {
          setBuying(false);
          gooeyToast.error(desc);
        },
        onDismiss: () => setBuying(false),
      });
    } catch {
      setBuying(false);
      gooeyToast.error("Failed to start checkout");
    }
  };

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <Select value={variantId} onValueChange={(value) => setVariantId(value ?? undefined)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending || outOfStock}
          className={cn(
            "transition-all duration-200 font-medium",
            isInCart && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30 font-medium"
          )}
          onClick={() =>
            startTransition(async () => {
              await addItem(product.id, 1, variantId);
              gooeyToast.success(`${product.name} added to cart`);
            })
          }
        >
          {outOfStock ? (
            "Out of stock"
          ) : pending ? (
            "Adding..."
          ) : isInCart ? (
            <span className="flex items-center justify-center gap-1.5 font-medium">
              <Check className="size-4" /> In Cart
            </span>
          ) : (
            "Add to cart"
          )}
        </Button>

        <Button disabled={buying || outOfStock} onClick={handleBuyNow} className="gap-1.5 font-semibold">
          {buying ? (
            "Loading..."
          ) : (
            <>
              <Zap className="size-4 fill-current" />
              <span>Buy Now</span>
            </>
          )}
        </Button>

        <Button variant="ghost" onClick={open} className="gap-1.5">
          <Sparkles className="size-4 text-primary" />
          <span>Shop with AI</span>
        </Button>
      </div>
    </div>
  );
}
