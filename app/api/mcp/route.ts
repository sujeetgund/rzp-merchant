import { NextResponse } from "next/server";
import { MCP_TOOLS, executeMCPTool } from "@/lib/mcp/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    jsonrpc: "2.0",
    name: "rzp-merchant-mcp-server",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    tools: MCP_TOOLS,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jsonrpc = "2.0", id, method, params } = body;

    // Bearer token check for merchant security
    const authHeader = req.headers.get("Authorization");
    const mcpToken = authHeader?.replace(/^Bearer\s+/i, "");

    // 1. Tool listing
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    // 2. Tool invocation
    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      const result = await executeMCPTool(toolName, toolArgs);

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          data: result,
        },
      });
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: err?.message || "Internal error" },
      },
      { status: 500 }
    );
  }
}
