import { NextResponse } from "next/server";
import { executeMCPTool } from "@/lib/mcp/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "payment_link";

    const result = await executeMCPTool("complete_checkout_session", {
      checkoutSessionId: id,
      mode,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
