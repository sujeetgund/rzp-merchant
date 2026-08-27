import Link from "next/link";
import { and, asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface StorePageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function StorePage({ searchParams }: StorePageProps) {
  const { q, category } = await searchParams;

  const categoryRows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .orderBy(asc(products.category));
  const categories = categoryRows.map((r) => r.category);

  const conditions = [];
  if (q) {
    conditions.push(
      or(ilike(products.name, `%${q}%`), ilike(products.description, `%${q}%`))
    );
  }
  if (category) {
    conditions.push(sql`${products.category} = ${category}`);
  }

  const results = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.name));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Shop the collection</h1>
          <p className="text-muted-foreground">
            Browse products, or click &ldquo;Shop with AI&rdquo; for personalized help.
          </p>
        </div>

        <form className="flex gap-2" action="/">
          {category && <input type="hidden" name="category" value={category} />}
          <Input name="q" placeholder="Search products..." defaultValue={q ?? ""} />
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"}>
            <Badge
              variant={!category ? "default" : "outline"}
              className={cn("cursor-pointer", !category && "hover:bg-primary/90")}
            >
              All
            </Badge>
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/?category=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              <Badge
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
              >
                {c}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No products match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
