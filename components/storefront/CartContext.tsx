"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { HydratedCart } from "@/lib/cart";

interface CartContextValue {
  cart: HydratedCart;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  removeItem: (productId: string, variantId?: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: HydratedCart = { items: [], total: 0, currency: "INR" };

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: HydratedCart;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<HydratedCart>(initialCart ?? EMPTY_CART);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (res.ok) setCart(await res.json());
  }, []);

  const addItem = useCallback(async (productId: string, quantity = 1, variantId?: string) => {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity, variantId }),
    });
    if (res.ok) setCart(await res.json());
  }, []);

  const updateQuantity = useCallback(
    async (productId: string, quantity: number, variantId?: string) => {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity, variantId }),
      });
      if (res.ok) setCart(await res.json());
    },
    []
  );

  const removeItem = useCallback(async (productId: string, variantId?: string) => {
    const res = await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, variantId }),
    });
    if (res.ok) setCart(await res.json());
  }, []);

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, itemCount, refresh, addItem, updateQuantity, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
