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
import { useSession } from "@/lib/auth/auth-client";
import { AuthModal } from "@/components/auth/AuthModal";

export function ProductDetailActions({ product }: { product: Product }) {
  const { addItem, cart } = useCart();
  const { open } = useAIDrawer();
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();
  const [buying, setBuying] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);

  const outOfStock = product.inventory === 0;
  const isInCart = cart.items.some((i) => i.productId === product.id);

  const handleBuyNow = async () => {
    if (buying || outOfStock) return;

    if (!session?.user) {
      setAuthModalOpen(true);
      return;
    }

    setBuying(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1, variantId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          setAuthModalOpen(true);
        } else {
          gooeyToast.error(data.error ?? "Failed to initialize Buy Now checkout.");
        }
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

  const handleAiAssistant = () => {
    if (!session?.user) {
      setAuthModalOpen(true);
    } else {
      open();
    }
  };

  return (
    <>
      <div className="space-y-4">
        {variants.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Select Variant</label>
            <Select value={variantId} onValueChange={(val) => setVariantId(val ?? undefined)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose option" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                    {v.extraPrice ? ` (+₹${(v.extraPrice / 100).toFixed(2)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "w-full text-xs font-medium transition-all duration-200",
              isInCart && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30"
            )}
            disabled={pending || outOfStock}
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
              <span className="flex items-center justify-center gap-1">
                <Check className="size-4 text-emerald-600" /> In Cart
              </span>
            ) : (
              "Add to cart"
            )}
          </Button>

          <Button
            size="lg"
            disabled={buying || outOfStock}
            onClick={handleBuyNow}
            className="w-full text-xs font-semibold gap-1.5"
          >
            {buying ? (
              "Loading..."
            ) : (
              <>
                <Zap className="size-4 fill-current text-amber-300" />
                <span>Buy Now</span>
              </>
            )}
          </Button>
        </div>

        <Button
          variant="secondary"
          size="lg"
          onClick={handleAiAssistant}
          className="w-full gap-2 text-xs font-medium"
        >
          <Sparkles className="size-4 text-amber-500" />
          <span>Ask AI Assistant about this product</span>
        </Button>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign In Required"
        description="Please sign in or create an account to proceed with purchase or talk to AI Assistant."
        onSuccess={() => handleBuyNow()}
      />
    </>
  );
}
