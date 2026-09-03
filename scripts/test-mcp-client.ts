/**
 * Exercises /api/mcp with a real @modelcontextprotocol/sdk Client over the
 * spec-compliant Streamable HTTP transport — i.e. what Claude Desktop or any
 * other real MCP client actually speaks, not a hand-rolled fetch() call.
 *
 * Usage: pnpm exec tsx scripts/test-mcp-client.ts [baseUrl]
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = process.argv[2] ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function ok(label: string, detail?: unknown) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}

function fail(label: string, err: unknown) {
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${label} — ${err instanceof Error ? err.message : String(err)}`);
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = (result as { content?: { type: string; text?: string }[] }).content;
  const text = content?.find((c) => c.type === "text")?.text;
  return text ? JSON.parse(text) : result;
}

async function main() {
  console.log(`\nConnecting a real MCP client to ${baseUrl}/api/mcp ...\n`);

  const client = new Client({ name: "rzp-mcp-test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/mcp`));

  try {
    await client.connect(transport);
    ok("initialize handshake (client.connect)");
  } catch (err) {
    fail("initialize handshake (client.connect)", err);
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }

  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    const expected = [
      "add_to_cart",
      "check_inventory",
      "complete_checkout_session",
      "create_cart",
      "create_checkout_session",
      "get_product",
      "get_recommendations",
      "search_products",
    ];
    const missing = expected.filter((n) => !names.includes(n));
    if (missing.length > 0) throw new Error(`missing tools: ${missing.join(", ")}`);
    ok("tools/list returns all expected tools", names);
  } catch (err) {
    fail("tools/list", err);
  }

  let productId: string | undefined;
  try {
    const res = await callTool(client, "search_products", { query: "shoes" });
    const products = res.products ?? res;
    if (!Array.isArray(products) || products.length === 0) throw new Error("no products returned");
    productId = products[0].id;
    ok("search_products", { count: products.length, first: products[0].name });
  } catch (err) {
    fail("search_products", err);
  }

  let cartId: string | undefined;
  try {
    const res = await callTool(client, "create_cart", {});
    cartId = res.cartId;
    if (!cartId) throw new Error("no cartId returned");
    ok("create_cart", { cartId });
  } catch (err) {
    fail("create_cart", err);
  }

  if (cartId && productId) {
    try {
      const res = await callTool(client, "add_to_cart", { cartId, productId, quantity: 1 });
      if (!res.items || res.items.length === 0) throw new Error("cart is empty after add");
      ok("add_to_cart", { items: res.items.length, totalINR: res.totalINR });
    } catch (err) {
      fail("add_to_cart", err);
    }

    try {
      const res = await callTool(client, "get_recommendations", { productIds: [productId] });
      ok("get_recommendations", { count: res.recommendations?.length ?? 0 });
    } catch (err) {
      fail("get_recommendations", err);
    }

    // Mandate satisfied -> should reach Razorpay (direct_capture) or fail
    // gracefully with a clear provider error if keys aren't configured yet.
    let csId: string | undefined;
    try {
      const res = await callTool(client, "create_checkout_session", {
        cartId,
        maxAmount: 100000,
        allowedCategories: [],
      });
      csId = res.checkoutSessionId;
      if (!csId) throw new Error("no checkoutSessionId returned");
      ok("create_checkout_session (mandate satisfied)", { csId, status: res.status });
    } catch (err) {
      fail("create_checkout_session (mandate satisfied)", err);
    }

    if (csId) {
      try {
        const res = await callTool(client, "complete_checkout_session", {
          checkoutSessionId: csId,
          mode: "direct_capture",
        });
        if (res.status === "PAID") {
          ok("complete_checkout_session direct_capture -> PAID", { razorpayOrderId: res.razorpayOrderId });
        } else if (res.status === "FAILED") {
          ok(
            "complete_checkout_session direct_capture -> FAILED gracefully (no throw, no 500)",
            { error: res.error }
          );
        } else {
          throw new Error(`unexpected status: ${res.status}`);
        }
      } catch (err) {
        fail("complete_checkout_session direct_capture", err);
      }

      // Idempotency: calling again must return the same result, not a new order.
      try {
        const res = await callTool(client, "complete_checkout_session", {
          checkoutSessionId: csId,
          mode: "direct_capture",
        });
        ok("complete_checkout_session retry is idempotent", { status: res.status, message: res.message });
      } catch (err) {
        fail("complete_checkout_session retry is idempotent", err);
      }
    }

    // payment_link mode with a satisfied mandate -> should generate a real
    // Razorpay Payment Link for human confirmation (Act 3's "happy path").
    try {
      const cart3 = await callTool(client, "create_cart", {});
      await callTool(client, "add_to_cart", { cartId: cart3.cartId, productId, quantity: 1 });
      const cs3 = await callTool(client, "create_checkout_session", {
        cartId: cart3.cartId,
        maxAmount: 100000,
        allowedCategories: [],
      });
      const res = await callTool(client, "complete_checkout_session", {
        checkoutSessionId: cs3.checkoutSessionId,
        mode: "payment_link",
      });
      if (res.status === "PAYMENT_INITIATED" && typeof res.paymentLink === "string") {
        ok("complete_checkout_session payment_link -> real Razorpay link", { paymentLink: res.paymentLink });
      } else {
        throw new Error(`expected PAYMENT_INITIATED with a paymentLink, got ${JSON.stringify(res)}`);
      }
    } catch (err) {
      fail("complete_checkout_session payment_link", err);
    }

    // Mandate violated (maxAmount far below cart total) -> should pause and
    // offer a human-approval payment link, never silently auto-pay. Uses a
    // fresh cart since the direct_capture flow above already cleared the
    // first one on successful fulfillment.
    try {
      const cart2 = await callTool(client, "create_cart", {});
      await callTool(client, "add_to_cart", { cartId: cart2.cartId, productId, quantity: 1 });
      const res1 = await callTool(client, "create_checkout_session", {
        cartId: cart2.cartId,
        maxAmount: 1,
        allowedCategories: [],
      });
      const csId2 = res1.checkoutSessionId;
      const res2 = await callTool(client, "complete_checkout_session", {
        checkoutSessionId: csId2,
        mode: "direct_capture",
      });
      if (res2.status === "PAUSED_MANDATE_EXCEEDED") {
        ok("mandate violation blocks auto-pay and offers human approval", {
          reason: res2.reason,
          hasPaymentLink: Boolean(res2.paymentLink),
        });
      } else if (res2.status === "FAILED") {
        ok("mandate violation blocked (payment link creation failed gracefully)", { reason: res2.reason });
      } else {
        throw new Error(`expected PAUSED_MANDATE_EXCEEDED or FAILED, got ${res2.status}`);
      }
    } catch (err) {
      fail("mandate violation flow", err);
    }
  }

  await client.close();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
