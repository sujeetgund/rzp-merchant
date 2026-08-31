"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
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

export function ProductDetailActions({ product }: { product: Product }) {
  const { addItem, cart } = useCart();
  const { open } = useAIDrawer();
  const [pending, startTransition] = useTransition();
  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);

  const outOfStock = product.inventory === 0;
  const isInCart = cart.items.some((i) => i.productId === product.id);

  return (
    <div className="space-y-3">
      {variants.length > 0 && (
        <Select value={variantId} onValueChange={(value) => setVariantId(value ?? undefined)}>
          <SelectTrigger className="w-40">
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

      <div className="flex gap-2">
        <Button
          disabled={pending || outOfStock}
          className={cn(
            "transition-all duration-200 font-medium",
            isInCart && "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 font-medium"
          )}
          onClick={() =>
            startTransition(async () => {
              await addItem(product.id, 1, variantId);
              toast.success(`${product.name} added to cart`);
            })
          }
        >
          {outOfStock ? (
            "Out of stock"
          ) : pending ? (
            "Adding..."
          ) : isInCart ? (
            <span className="flex items-center justify-center gap-1.5 font-medium">
              <Check className="size-4" /> Added to Cart
            </span>
          ) : (
            "Add to cart"
          )}
        </Button>
        <Button variant="outline" onClick={open} className="gap-1.5">
          <Sparkles className="size-4" />
          Shop with AI
        </Button>
      </div>
    </div>
  );
}
