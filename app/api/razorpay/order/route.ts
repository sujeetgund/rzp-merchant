import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createCheckoutForSession } from "@/lib/commerce/checkout";

export async function POST() {
  const sessionId = await getSessionId();

  try {
    const result = await createCheckoutForSession(sessionId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
