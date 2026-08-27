import { notFound } from "next/navigation";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/format";
import { ProductDetailActions } from "@/components/storefront/ProductDetailActions";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
          {product.imageUrl && (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Badge variant="outline">{product.category}</Badge>
            <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
            <p className="mt-2 text-xl">{formatPaise(product.price)}</p>
          </div>
          <p className="text-muted-foreground">{product.description}</p>
          <p className="text-sm text-muted-foreground">
            {product.inventory > 0 ? `${product.inventory} in stock` : "Out of stock"}
          </p>
          <ProductDetailActions product={product} />
        </div>
      </div>
    </div>
  );
}
