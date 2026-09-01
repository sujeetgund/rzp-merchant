"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/storefront/CartContext";
import type { Product } from "@/lib/db/schema";
import { openRazorpayCheckout, verifyPaymentOnServer } from "@/lib/razorpay/checkoutClient";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, cart } = useCart();
  const [pending, startTransition] = useTransition();
  const [buying, setBuying] = useState(false);
  const hasVariants = Boolean(product.variants?.length);
  const isInCart = cart.items.some((i) => i.productId === product.id);

  const handleBuyNow = async () => {
    if (buying || product.inventory === 0) return;
    setBuying(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
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
    <Card className="flex flex-col overflow-hidden pt-0 shadow-2xs hover:shadow-xs transition-all">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square w-full bg-muted">
          {product.imageUrl && (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          )}
        </div>
      </Link>
      <CardContent className="flex-1 space-y-1 pt-4">
        <Badge variant="outline" className="mb-1 text-[10px]">
          {product.category}
        </Badge>
        <Link href={`/products/${product.id}`} className="block font-semibold text-sm hover:underline leading-tight">
          {product.name}
        </Link>
        <p className="text-sm font-bold text-foreground">{formatPaise(product.price)}</p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 pt-2">
        {hasVariants ? (
          <Button
            render={<Link href={`/products/${product.id}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="col-span-2 w-full text-xs"
          >
            Choose options
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-full text-xs transition-all duration-200",
                isInCart && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30"
              )}
              disabled={pending || product.inventory === 0}
              onClick={() =>
                startTransition(async () => {
                  await addItem(product.id, 1);
                  gooeyToast.success(`${product.name} added to cart`);
                })
              }
            >
              {product.inventory === 0 ? (
                "Out of stock"
              ) : pending ? (
                "Adding..."
              ) : isInCart ? (
                <span className="flex items-center justify-center gap-1 font-medium text-[11px]">
                  <Check className="size-3" /> In Cart
                </span>
              ) : (
                "Add to cart"
              )}
            </Button>

            <Button
              size="sm"
              disabled={buying || product.inventory === 0}
              onClick={handleBuyNow}
              className="w-full text-xs gap-1 font-medium"
            >
              {buying ? (
                "Loading..."
              ) : (
                <>
                  <Zap className="size-3 fill-current" />
                  <span>Buy Now</span>
                </>
              )}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
