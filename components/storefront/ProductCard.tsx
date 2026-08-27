"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/storefront/CartContext";
import type { Product } from "@/lib/db/schema";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [pending, startTransition] = useTransition();
  const hasVariants = Boolean(product.variants?.length);

  return (
    <Card className="flex flex-col overflow-hidden pt-0">
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
        <Badge variant="outline" className="mb-1">
          {product.category}
        </Badge>
        <Link href={`/products/${product.id}`} className="block font-medium hover:underline">
          {product.name}
        </Link>
        <p className="text-sm text-muted-foreground">{formatPaise(product.price)}</p>
      </CardContent>
      <CardFooter>
        {hasVariants ? (
          <Button
            render={<Link href={`/products/${product.id}`} />}
            nativeButton={false}
            variant="outline"
            className="w-full"
          >
            Choose options
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={pending || product.inventory === 0}
            onClick={() =>
              startTransition(async () => {
                await addItem(product.id, 1);
                toast.success(`${product.name} added to cart`);
              })
            }
          >
            {product.inventory === 0 ? "Out of stock" : "Add to cart"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
