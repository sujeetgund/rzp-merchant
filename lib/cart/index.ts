import { redis } from "@/lib/redis/client";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export interface CartItem {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface HydratedCartItem extends CartItem {
  name: string;
  price: number; // paise, includes variant extra price
  imageUrl: string | null;
  inventory: number;
  lineTotal: number; // paise
}

export interface HydratedCart {
  items: HydratedCartItem[];
  total: number; // paise
  currency: "INR";
}

const CART_TTL_SECONDS = 60 * 60 * 24 * 7;

function cartKey(sessionId: string) {
  return `cart:${sessionId}`;
}

export async function getRawCart(sessionId: string): Promise<CartItem[]> {
  const raw = await redis.get(cartKey(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRawCart(sessionId: string, items: CartItem[]): Promise<void> {
  await redis.set(cartKey(sessionId), JSON.stringify(items), "EX", CART_TTL_SECONDS);
}

function sameLine(a: CartItem, b: { productId: string; variantId?: string }) {
  return a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);
}

export async function addToCart(
  sessionId: string,
  productId: string,
  quantity: number,
  variantId?: string
): Promise<CartItem[]> {
  const items = await getRawCart(sessionId);
  const existing = items.find((i) => sameLine(i, { productId, variantId }));
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity, variantId });
  }
  const cleaned = items.filter((i) => i.quantity > 0);
  await saveRawCart(sessionId, cleaned);
  return cleaned;
}

export async function setCartItemQuantity(
  sessionId: string,
  productId: string,
  quantity: number,
  variantId?: string
): Promise<CartItem[]> {
  const items = await getRawCart(sessionId);
  const existing = items.find((i) => sameLine(i, { productId, variantId }));
  if (existing) {
    existing.quantity = quantity;
  } else if (quantity > 0) {
    items.push({ productId, quantity, variantId });
  }
  const cleaned = items.filter((i) => i.quantity > 0);
  await saveRawCart(sessionId, cleaned);
  return cleaned;
}

export async function removeFromCart(
  sessionId: string,
  productId: string,
  variantId?: string
): Promise<CartItem[]> {
  const items = await getRawCart(sessionId);
  const remaining = items.filter((i) => !sameLine(i, { productId, variantId }));
  await saveRawCart(sessionId, remaining);
  return remaining;
}

export async function clearCart(sessionId: string): Promise<void> {
  await redis.del(cartKey(sessionId));
}

export async function getHydratedCart(sessionId: string): Promise<HydratedCart> {
  const items = await getRawCart(sessionId);
  if (items.length === 0) {
    return { items: [], total: 0, currency: "INR" };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const rows = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));
  const byId = new Map(rows.map((p) => [p.id, p]));

  const hydrated: HydratedCartItem[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const variant = item.variantId
      ? product.variants?.find((v) => v.id === item.variantId)
      : undefined;
    const price = product.price + (variant?.extraPrice ?? 0);
    hydrated.push({
      ...item,
      name: variant ? `${product.name} (${variant.name})` : product.name,
      price,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      lineTotal: price * item.quantity,
    });
  }

  const total = hydrated.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items: hydrated, total, currency: "INR" };
}
