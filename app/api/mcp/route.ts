import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createSDKMCPServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, mcp-protocol-version, Last-Event-ID, Authorization",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
} as const;

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Real MCP Streamable HTTP endpoint (spec: 2025-06-18 Streamable HTTP transport).
 *
 * Stateless mode: a fresh McpServer + transport is created per request (no
 * sessionIdGenerator), matching how Next.js route handlers execute — no
 * in-memory session map to leak across hot reloads or serverless instances.
 * Actual application state (cart, checkout sessions) already lives in
 * Redis/Postgres, independent of the MCP transport's own session concept.
 */
async function handleMcpRequest(request: Request): Promise<Response> {
  // JSON response mode (instead of SSE framing) so plain fetch().then(r =>
  // r.json()) clients — like the in-app AI-buyer demo page — work directly,
  // while real MCP clients (which handle both modes per spec) are unaffected.
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createSDKMCPServer();
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
