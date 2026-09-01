import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createCheckoutForSession, createDirectCheckoutForProduct } from "@/lib/commerce/checkout";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to place orders." },
      { status: 401 }
    );
  }

  const sessionId = await getSessionId();

  try {
    const body = await req.json().catch(() => ({}));
    const { productId, quantity = 1, variantId } = body;

    let result;
    if (productId && typeof productId === "string") {
      result = await createDirectCheckoutForProduct(sessionId, productId, quantity, variantId, session.user.id);
    } else {
      result = await createCheckoutForSession(sessionId, session.user.id);
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
