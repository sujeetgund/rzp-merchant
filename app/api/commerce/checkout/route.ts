import { NextResponse } from "next/server";
import { executeMCPTool } from "@/lib/mcp/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cartId, maxAmount, allowedCategories } = body;

    if (!cartId || typeof maxAmount !== "number") {
      return NextResponse.json(
        { error: "Missing required parameters: cartId and maxAmount (number)" },
        { status: 400 }
      );
    }

    const result = await executeMCPTool("create_checkout_session", {
      cartId,
      maxAmount,
      allowedCategories,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
