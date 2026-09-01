"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Search, Package, ArrowRight } from "lucide-react";
import { formatPaise } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/ui/autocomplete";

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  description?: string;
}

interface ProductAutocompleteProps {
  products: ProductItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const SPRING = { type: "spring", bounce: 0.15, duration: 0.3 } as const;

export function ProductAutocomplete({
  products,
  searchQuery,
  onSearchChange,
}: ProductAutocompleteProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Filter matching products
  const matchingProducts = searchQuery.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleSelect = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  return (
    <div className="relative w-full">
      <Autocomplete
        defaultInputValue={searchQuery}
        onInputValueChange={(val) => {
          onSearchChange(val);
          setIsOpen(Boolean(val.trim()));
        }}
      >
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-3.5 size-4 text-muted-foreground z-10" />
          <AutocompleteInput
            placeholder="Search catalog by product name, category, or keyword..."
            showClear
            className="w-full h-11 pl-10 pr-12 text-xs sm:text-sm bg-card border border-border shadow-2xs rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
          />
          <Button
            type="submit"
            size="icon-sm"
            className="absolute right-2 top-2 size-7 rounded-lg bg-primary text-primary-foreground shrink-0 transition-transform active:scale-95"
            title="Search Catalog"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {searchQuery.trim() !== "" && isOpen && (
          <AutocompleteContent className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl">
            {matchingProducts.length === 0 ? (
              <AutocompleteStatus className="py-4 text-center text-xs text-muted-foreground">
                No products found matching &quot;{searchQuery}&quot;
              </AutocompleteStatus>
            ) : (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b mb-1 flex items-center justify-between">
                  <span>Matching Catalog Items</span>
                  <span>{matchingProducts.length} results</span>
                </div>
                <AutocompleteList>
                  {matchingProducts.slice(0, 6).map((product, idx) => (
                    <AutocompleteItem
                      key={product.id}
                      value={product.id}
                      label={product.name}
                      onSelect={() => handleSelect(product.id)}
                      className="rounded-lg p-2 hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING, delay: idx * 0.03 }}
                        className="flex w-full items-center gap-3"
                      >
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted border">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="size-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {product.name}
                            </p>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal mt-0.5">
                              {product.category}
                            </Badge>
                          </div>
                          <span className="font-mono text-xs font-bold text-foreground shrink-0">
                            {formatPaise(product.price)}
                          </span>
                        </div>
                      </motion.div>
                    </AutocompleteItem>
                  ))}
                </AutocompleteList>
              </>
            )}
          </AutocompleteContent>
        )}
      </Autocomplete>
    </div>
  );
}
