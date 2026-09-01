import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createCheckoutForSession, createDirectCheckoutForProduct } from "@/lib/commerce/checkout";

export async function POST(req: Request) {
  const sessionId = await getSessionId();

  try {
    const body = await req.json().catch(() => ({}));
    const { productId, quantity = 1, variantId } = body;

    let result;
    if (productId && typeof productId === "string") {
      result = await createDirectCheckoutForProduct(sessionId, productId, quantity, variantId);
    } else {
      result = await createCheckoutForSession(sessionId);
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
