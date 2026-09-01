"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductAutocomplete, type ProductItem } from "@/components/storefront/ProductAutocomplete";

interface StoreSearchSectionProps {
  products: ProductItem[];
  initialQuery?: string;
  category?: string;
}

export function StoreSearchSection({
  products,
  initialQuery = "",
  category,
}: StoreSearchSectionProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    router.push(`/?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <ProductAutocomplete
        products={products}
        searchQuery={query}
        onSearchChange={setQuery}
      />
    </form>
  );
}
