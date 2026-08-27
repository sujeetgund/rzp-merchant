"use client";

import Link from "next/link";
import { ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/storefront/CartContext";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";

export function StoreHeader() {
  const { itemCount } = useCart();
  const { open } = useAIDrawer();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          rzp Store
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={open} className="gap-1.5">
            <Sparkles className="size-4" />
            Shop with AI
          </Button>
          <Button
            render={<Link href="/cart" />}
            nativeButton={false}
            variant="outline"
            size="icon"
            className="relative"
          >
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1">
                {itemCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
