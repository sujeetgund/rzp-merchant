import Link from "next/link";
import { and, asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles } from "lucide-react";
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
      {/* Clean Modern E-Commerce Header */}
      <div className="mb-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Essential Collection</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover premium products curated for quality, style, and performance.
            </p>
          </div>
        </div>

        {/* Clean Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <form className="relative flex-1 flex gap-2" action="/">
            {category && <input type="hidden" name="category" value={category} />}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search catalog..."
                defaultValue={q ?? ""}
                className="pl-9 h-10 bg-card border-border/80 shadow-2xs"
              />
            </div>
            <Button type="submit" className="h-10 px-5 font-medium">
              Search
            </Button>
          </form>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"}>
            <Badge
              variant={!category ? "default" : "secondary"}
              className={cn(
                "cursor-pointer text-xs px-3.5 py-1.5 rounded-full font-medium transition-all",
                !category && "bg-primary text-primary-foreground shadow-2xs"
              )}
            >
              All Products
            </Badge>
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/?category=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              <Badge
                variant={category === c ? "default" : "secondary"}
                className={cn(
                  "cursor-pointer text-xs px-3.5 py-1.5 rounded-full font-medium transition-all",
                  category === c && "bg-primary text-primary-foreground shadow-2xs"
                )}
              >
                {c}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {results.length === 0 ? (
        <div className="py-24 text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No products found</p>
          <p className="text-xs text-muted-foreground">Try searching with a different query or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
