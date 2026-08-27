import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionId } from "@/lib/session";
import { addToCart, getHydratedCart, removeFromCart, setCartItemQuantity } from "@/lib/cart";

export async function GET() {
  const sessionId = await getSessionId();
  const cart = await getHydratedCart(sessionId);
  return NextResponse.json(cart);
}

const addSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).default(1),
  variantId: z.string().optional(),
});

export async function POST(request: Request) {
  const sessionId = await getSessionId();
  const body = addSchema.parse(await request.json());
  await addToCart(sessionId, body.productId, body.quantity, body.variantId);
  const cart = await getHydratedCart(sessionId);
  return NextResponse.json(cart);
}

const patchSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(0),
  variantId: z.string().optional(),
});

export async function PATCH(request: Request) {
  const sessionId = await getSessionId();
  const body = patchSchema.parse(await request.json());
  await setCartItemQuantity(sessionId, body.productId, body.quantity, body.variantId);
  const cart = await getHydratedCart(sessionId);
  return NextResponse.json(cart);
}

const removeSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
});

export async function DELETE(request: Request) {
  const sessionId = await getSessionId();
  const body = removeSchema.parse(await request.json());
  await removeFromCart(sessionId, body.productId, body.variantId);
  const cart = await getHydratedCart(sessionId);
  return NextResponse.json(cart);
}
