import { db } from "@/lib/db";
import { products, orderItems, orders, checkoutSessions, auditLogs } from "@/lib/db/schema";
import { and, asc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { getRazorpay } from "@/lib/razorpay/client";
import { evaluateCheckoutPolicy } from "@/lib/agent/policy";
import { fulfillOrderAndReduceInventory } from "@/lib/commerce/inventory";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: "search_products",
    description: "Search merchant catalog products by natural language query, category, or maximum price.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term or product keyword" },
        maxPrice: { type: "number", description: "Maximum price filter in INR (₹)" },
        category: { type: "string", description: "Product category name" },
      },
    },
  },
  {
    name: "get_product",
    description: "Retrieve full details and live inventory for a specific product by ID.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "UUID of the product" },
      },
      required: ["productId"],
    },
  },
  {
    name: "check_inventory",
    description: "Check live stock availability for a product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "UUID of the product" },
      },
      required: ["productId"],
    },
  },
  {
    name: "get_recommendations",
    description: "Get co-purchased cross-sell product recommendations based on market basket analysis.",
    inputSchema: {
      type: "object",
      properties: {
        productIds: {
          type: "array",
          items: { type: "string" },
          description: "List of product UUIDs currently in cart or viewed",
        },
      },
      required: ["productIds"],
    },
  },
  {
    name: "create_cart",
    description: "Create a new shopping cart session for an AI buyer.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Optional customer user ID" },
      },
    },
  },
  {
    name: "add_to_cart",
    description: "Add a product item to a shopping cart session.",
    inputSchema: {
      type: "object",
      properties: {
        cartId: { type: "string", description: "Cart session ID" },
        productId: { type: "string", description: "Product UUID to add" },
        quantity: { type: "number", description: "Quantity to add (default 1)" },
      },
      required: ["cartId", "productId"],
    },
  },
  {
    name: "create_checkout_session",
    description: "Create an Agentic Commerce Protocol (ACP) checkout session declaring the buyer's spending mandate.",
    inputSchema: {
      type: "object",
      properties: {
        cartId: { type: "string", description: "Cart session ID" },
        maxAmount: { type: "number", description: "Maximum budget mandate declared by human buyer in INR (₹)" },
        allowedCategories: {
          type: "array",
          items: { type: "string" },
          description: "Allowed product categories mandate",
        },
      },
      required: ["cartId", "maxAmount"],
    },
  },
  {
    name: "complete_checkout_session",
    description: "Execute ACP checkout completion, validate spending mandates, and generate Razorpay payment order.",
    inputSchema: {
      type: "object",
      properties: {
        checkoutSessionId: { type: "string", description: "Checkout session ID (cs_...)" },
        mode: {
          type: "string",
          enum: ["payment_link", "direct_capture"],
          description: "Completion mode: 'payment_link' for human approval or 'direct_capture' for automated test mode",
        },
      },
      required: ["checkoutSessionId"],
    },
  },
];

/**
 * Creates a real `orders` (+ `order_items`) row backing a checkout session's
 * Razorpay order, so ACP/MCP-driven sales show up in the merchant's Orders
 * dashboard exactly like storefront sales, and so the existing webhook +
 * payment-link-redirect fulfillment paths (which key off `orders`) work for
 * this channel too instead of needing a parallel implementation.
 */
async function createPendingOrderForCheckoutSession(
  cs: typeof checkoutSessions.$inferSelect,
  rzpOrderId: string,
  userId: string | null
) {
  const items = (cs.items as { productId: string; quantity: number; price: number }[]) || [];
  const [order] = await db
    .insert(orders)
    .values({
      sessionId: cs.sessionId,
      userId,
      razorpayOrderId: rzpOrderId,
      amount: cs.amount,
      currency: cs.currency,
      status: "created",
      idempotencyKey: `acp_${cs.id}`,
    })
    .returning();

  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }))
  );

  return order;
}

export async function executeMCPTool(name: string, args: Record<string, any>, options?: { userId?: string; sessionId?: string }) {
  const sessionId = options?.sessionId || `mcp_sess_${Date.now()}`;
  const userId = options?.userId || null;

  switch (name) {
    case "search_products": {
      const { query, maxPrice, category } = args;
      const conditions = [];
      if (query) {
        conditions.push(or(ilike(products.name, `%${query}%`), ilike(products.description, `%${query}%`)));
      }
      if (category) {
        conditions.push(eq(products.category, category));
      }
      if (typeof maxPrice === "number") {
        conditions.push(lte(products.price, Math.round(maxPrice * 100)));
      }

      const rows = await db
        .select()
        .from(products)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(products.name))
        .limit(10);

      const items = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        priceINR: r.price / 100,
        category: r.category,
        inventory: r.inventory,
        imageUrl: r.imageUrl,
      }));

      await db.insert(auditLogs).values({
        sessionId,
        action: "MCP_SEARCH_PRODUCTS",
        input: args,
        output: { count: items.length },
        explanation: `MCP Agent searched products (query: "${query || "all"}", maxPrice: ₹${maxPrice || "any"})`,
        riskLevel: "LOW",
      });

      return { products: items };
    }

    case "get_product": {
      const { productId } = args;
      const [row] = await db.select().from(products).where(eq(products.id, productId));
      if (!row) throw new Error(`Product not found: ${productId}`);

      return {
        product: {
          id: row.id,
          name: row.name,
          description: row.description,
          priceINR: row.price / 100,
          category: row.category,
          inventory: row.inventory,
          imageUrl: row.imageUrl,
        },
      };
    }

    case "check_inventory": {
      const { productId } = args;
      const [row] = await db.select({ inventory: products.inventory, name: products.name }).from(products).where(eq(products.id, productId));
      if (!row) throw new Error(`Product not found: ${productId}`);

      return {
        productId,
        name: row.name,
        inStock: row.inventory > 0,
        availableQuantity: row.inventory,
      };
    }

    case "get_recommendations": {
      const { productIds } = args;
      if (!Array.isArray(productIds) || productIds.length === 0) return { recommendations: [] };

      const rows = await db.execute<{
        product_id: string;
        name: string;
        price: number;
        image_url: string | null;
        co_count: string;
      }>(sql`
        SELECT p.id AS product_id, p.name, p.price, p.image_url, COUNT(*)::text AS co_count
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id IN (
          SELECT order_id FROM order_items WHERE product_id IN ${productIds}
        )
        AND p.id NOT IN ${productIds}
        GROUP BY p.id, p.name, p.price, p.image_url
        ORDER BY COUNT(*) DESC
        LIMIT 4
      `);

      return {
        recommendations: rows.map((r) => ({
          productId: r.product_id,
          name: r.name,
          priceINR: Number(r.price) / 100,
          imageUrl: r.image_url,
          coPurchaseCount: Number(r.co_count),
        })),
      };
    }

    case "create_cart": {
      const cartId = `cart_${Math.random().toString(36).substring(2, 12)}`;
      await redis.set(`cart:${cartId}`, JSON.stringify({ items: [] }), "EX", 86400 * 7);

      return { cartId, items: [] };
    }

    case "add_to_cart": {
      const { cartId, productId, quantity = 1 } = args;
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      if (!product) throw new Error(`Product not found: ${productId}`);

      const raw = await redis.get(`cart:${cartId}`);
      let cart = raw ? JSON.parse(raw) : { items: [] };

      const existingIndex = cart.items.findIndex((i: any) => i.productId === productId);
      if (existingIndex >= 0) {
        cart.items[existingIndex].quantity += quantity;
      } else {
        cart.items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          quantity,
          imageUrl: product.imageUrl,
        });
      }

      await redis.set(`cart:${cartId}`, JSON.stringify(cart), "EX", 86400 * 7);

      const totalINR = cart.items.reduce((sum: number, i: any) => sum + (i.price / 100) * i.quantity, 0);

      await db.insert(auditLogs).values({
        sessionId: cartId,
        action: "MCP_ADD_TO_CART",
        input: args,
        output: { cartItemsCount: cart.items.length, totalINR },
        explanation: `MCP Agent added ${quantity}x "${product.name}" (₹${product.price / 100}) to cart ${cartId}`,
        riskLevel: "MEDIUM",
      });

      return { cartId, items: cart.items, totalINR };
    }

    case "create_checkout_session": {
      const { cartId, maxAmount, allowedCategories } = args;
      const raw = await redis.get(`cart:${cartId}`);
      if (!raw) throw new Error(`Cart not found or expired: ${cartId}`);

      const cart = JSON.parse(raw);
      if (!cart.items || cart.items.length === 0) throw new Error("Cart is empty");

      const totalPaise = cart.items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
      const totalINR = totalPaise / 100;
      const csId = `cs_${Math.random().toString(36).substring(2, 12)}`;

      const mandate = {
        maxAmount,
        allowedCategories: allowedCategories || [],
        declaredBy: "external-mcp-buyer-agent",
      };

      const expiresAt = new Date(Date.now() + 3600 * 1000);

      await db.insert(checkoutSessions).values({
        id: csId,
        sessionId: cartId,
        userId,
        status: "DRAFT",
        amount: totalPaise,
        currency: "INR",
        items: cart.items,
        buyerMandate: mandate,
        expiresAt,
      });

      await db.insert(auditLogs).values({
        sessionId: cartId,
        action: "MCP_CREATE_CHECKOUT_SESSION",
        input: args,
        output: { checkoutSessionId: csId, totalINR, mandate },
        explanation: `ACP Checkout Session created (${csId}) with buyer maxAmount mandate ₹${maxAmount}`,
        riskLevel: "HIGH",
      });

      return {
        checkoutSessionId: csId,
        status: "DRAFT",
        items: cart.items,
        totalINR,
        buyerMandate: mandate,
        expiresAt: expiresAt.toISOString(),
      };
    }

    case "complete_checkout_session": {
      const { checkoutSessionId, mode = "payment_link" } = args;
      const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, checkoutSessionId));
      if (!cs) throw new Error(`Checkout session not found: ${checkoutSessionId}`);

      const mandate = cs.buyerMandate as { maxAmount: number; allowedCategories?: string[] } | null;
      const totalINR = cs.amount / 100;
      const items = (cs.items as any[]) || [];

      // IDEMPOTENCY: never re-charge or re-issue for a session that's already
      // resolved. Retries (network blips, an eager agent calling twice) must
      // return the prior result, not create a second Razorpay order.
      if (cs.status === "PAID") {
        return {
          status: "PAID",
          razorpayOrderId: cs.razorpayOrderId,
          amountINR: totalINR,
          currency: "INR",
          message: "Already completed — reusing prior result (idempotent).",
        };
      }
      if (cs.status === "PAYMENT_INITIATED" && cs.paymentLink) {
        return {
          status: "PAYMENT_INITIATED",
          razorpayOrderId: cs.razorpayOrderId,
          paymentLink: cs.paymentLink,
          amountINR: totalINR,
          message: "Payment link already generated — reusing prior result (idempotent).",
        };
      }
      if (cs.status === "PAUSED_MANDATE_EXCEEDED" && cs.paymentLink) {
        return {
          status: "PAUSED_MANDATE_EXCEEDED",
          razorpayOrderId: cs.razorpayOrderId,
          paymentLink: cs.paymentLink,
          requiresHumanApproval: true,
          message: "Human-approval payment link already generated — reusing prior result (idempotent).",
        };
      }

      // EXPIRATION CHECK
      if (cs.expiresAt && new Date() > new Date(cs.expiresAt)) {
        await db.insert(auditLogs).values({
          sessionId: cs.sessionId,
          action: "MCP_SESSION_EXPIRED",
          input: args,
          output: { expiresAt: cs.expiresAt },
          explanation: `POLICY BLOCKED: ACP Checkout Session ${checkoutSessionId} has expired.`,
          riskLevel: "HIGH",
        });
        throw new Error(`Checkout session ${checkoutSessionId} has expired.`);
      }

      // Live inventory check against current stock (not the cart snapshot).
      const inventoryCheck = [];
      for (const item of items) {
        const [row] = await db
          .select({ inventory: products.inventory })
          .from(products)
          .where(eq(products.id, item.productId));
        inventoryCheck.push({
          name: item.name,
          quantity: item.quantity,
          availableInventory: row?.inventory ?? 0,
        });
      }

      const policy = await evaluateCheckoutPolicy({
        sessionId: cs.sessionId,
        totalInRupees: totalINR,
        items: items.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity, priceInRupees: i.price / 100 })),
        inventoryCheck,
        mandate,
      });

      if (!policy.allowed) {
        await db.insert(auditLogs).values({
          sessionId: cs.sessionId,
          action: "MCP_MANDATE_VIOLATION",
          input: args,
          output: { totalINR, mandate, violations: policy.violations },
          explanation: `POLICY BLOCKED: ${policy.reason}`,
          riskLevel: policy.risk,
        });

        try {
          const razorpay = getRazorpay();
          const rzpOrder = await razorpay.orders.create({
            amount: cs.amount,
            currency: "INR",
            receipt: `${cs.id}_mandate_override`,
            notes: { checkoutSessionId: cs.id, sessionId: cs.sessionId, mandateViolation: "true" },
          });
          const order = await createPendingOrderForCheckoutSession(cs, rzpOrder.id, userId);

          const link = await razorpay.paymentLink.create({
            amount: cs.amount,
            currency: "INR",
            accept_partial: false,
            description: `Human Approval Needed: ${policy.reason.slice(0, 80)}`,
            customer: { name: "Agentic Buyer", email: "agent@rzp-merchant.local" },
            notify: { sms: false, email: false },
            callback_url: `${APP_URL}/order/${order.id}`,
            callback_method: "get",
          });

          await db
            .update(checkoutSessions)
            .set({ status: "PAUSED_MANDATE_EXCEEDED", razorpayOrderId: rzpOrder.id, paymentLink: link.short_url })
            .where(eq(checkoutSessions.id, checkoutSessionId));

          return {
            status: "PAUSED_MANDATE_EXCEEDED",
            reason: policy.reason,
            violations: policy.violations,
            requiresHumanApproval: true,
            paymentLink: link.short_url,
          };
        } catch (err) {
          const description =
            (err as { error?: { description?: string } })?.error?.description ??
            (err as Error).message ??
            "Could not reach Razorpay";
          await db
            .update(checkoutSessions)
            .set({ status: "FAILED" })
            .where(eq(checkoutSessions.id, checkoutSessionId));
          return {
            status: "FAILED",
            reason: policy.reason,
            violations: policy.violations,
            paymentLinkError: description,
          };
        }
      }

      let rzpOrder: { id: string };
      try {
        const razorpay = getRazorpay();
        rzpOrder = await razorpay.orders.create({
          amount: cs.amount,
          currency: "INR",
          receipt: cs.id,
          notes: { checkoutSessionId: cs.id, sessionId: cs.sessionId },
        });
      } catch (err) {
        const description =
          (err as { error?: { description?: string } })?.error?.description ??
          (err as Error).message ??
          "Could not reach Razorpay";
        await db.update(checkoutSessions).set({ status: "FAILED" }).where(eq(checkoutSessions.id, checkoutSessionId));
        await db.insert(auditLogs).values({
          sessionId: cs.sessionId,
          action: "MCP_CHECKOUT_FAILED",
          input: args,
          output: { error: description },
          explanation: `Razorpay order creation failed for checkout session ${cs.id}: ${description}. No charge was made.`,
          riskLevel: "MEDIUM",
        });
        return { status: "FAILED", error: `Payment provider error: ${description}` };
      }

      const order = await createPendingOrderForCheckoutSession(cs, rzpOrder.id, userId);

      if (mode === "direct_capture") {
        // Approach B (see implementation_plan.md): simulated instant capture,
        // test-mode only. No real payment happens — we mark the order paid
        // and decrement stock directly, reusing the same fulfillment path a
        // real webhook would trigger, so this channel and the storefront
        // channel behave identically from here on.
        await fulfillOrderAndReduceInventory(order.id, `sim_${rzpOrder.id}`);
        await db
          .update(checkoutSessions)
          .set({ status: "PAID", razorpayOrderId: rzpOrder.id })
          .where(eq(checkoutSessions.id, checkoutSessionId));

        await db.insert(auditLogs).values({
          sessionId: cs.sessionId,
          action: "MCP_CHECKOUT_COMPLETED",
          input: args,
          output: { razorpayOrderId: rzpOrder.id, orderId: order.id, amountINR: totalINR },
          explanation: `Automated ACP Checkout Completed! Razorpay Order ${rzpOrder.id} generated for ₹${totalINR}`,
          riskLevel: policy.risk,
        });

        return {
          status: "PAID",
          razorpayOrderId: rzpOrder.id,
          orderId: order.id,
          amountINR: totalINR,
          currency: "INR",
          message: "Payment completed successfully via automated test capture.",
        };
      } else {
        let link: { short_url: string };
        try {
          const razorpay = getRazorpay();
          link = await razorpay.paymentLink.create({
            amount: cs.amount,
            currency: "INR",
            accept_partial: false,
            description: `Razorpay Payment for ACP Order ${checkoutSessionId}`,
            customer: { name: "Agentic Buyer", email: "agent@rzp-merchant.local" },
            notify: { sms: false, email: false },
            callback_url: `${APP_URL}/order/${order.id}`,
            callback_method: "get",
          });
        } catch (err) {
          const description =
            (err as { error?: { description?: string } })?.error?.description ??
            (err as Error).message ??
            "Could not reach Razorpay";
          await db.update(checkoutSessions).set({ status: "FAILED" }).where(eq(checkoutSessions.id, checkoutSessionId));
          return { status: "FAILED", error: `Payment link creation failed: ${description}` };
        }

        await db
          .update(checkoutSessions)
          .set({ status: "PAYMENT_INITIATED", razorpayOrderId: rzpOrder.id, paymentLink: link.short_url })
          .where(eq(checkoutSessions.id, checkoutSessionId));

        await db.insert(auditLogs).values({
          sessionId: cs.sessionId,
          action: "MCP_PAYMENT_LINK_GENERATED",
          input: args,
          output: { razorpayOrderId: rzpOrder.id, orderId: order.id, paymentLink: link.short_url },
          explanation: `Razorpay Payment Link generated: ${link.short_url} for ₹${totalINR}`,
          riskLevel: policy.risk,
        });

        return {
          status: "PAYMENT_INITIATED",
          razorpayOrderId: rzpOrder.id,
          orderId: order.id,
          paymentLink: link.short_url,
          amountINR: totalINR,
          message: "Payment link generated for human confirmation.",
        };
      }
    }

    default:
      throw new Error(`Unknown MCP Tool: ${name}`);
  }
}

/**
 * Creates an instance of official @modelcontextprotocol/sdk McpServer
 */
export function createSDKMCPServer() {
  const server = new McpServer({
    name: "rzp-merchant-mcp",
    version: "1.0.0",
  });

  server.tool(
    "search_products",
    "Search merchant catalog products by query, category, or maxPrice.",
    {
      query: z.string().optional(),
      maxPrice: z.number().optional(),
      category: z.string().optional(),
    },
    async (args) => {
      const res = await executeMCPTool("search_products", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "get_product",
    "Retrieve details and inventory for a specific product by ID.",
    { productId: z.string() },
    async (args) => {
      const res = await executeMCPTool("get_product", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "check_inventory",
    "Check live stock availability for a product.",
    { productId: z.string() },
    async (args) => {
      const res = await executeMCPTool("check_inventory", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "get_recommendations",
    "Get co-purchased cross-sell product recommendations.",
    { productIds: z.array(z.string()) },
    async (args) => {
      const res = await executeMCPTool("get_recommendations", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "create_cart",
    "Create a new shopping cart session for an AI buyer.",
    { userId: z.string().optional() },
    async (args) => {
      const res = await executeMCPTool("create_cart", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "add_to_cart",
    "Add a product item to a shopping cart session.",
    {
      cartId: z.string(),
      productId: z.string(),
      quantity: z.number().optional(),
    },
    async (args) => {
      const res = await executeMCPTool("add_to_cart", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "create_checkout_session",
    "Create an ACP checkout session declaring the buyer spending mandate.",
    {
      cartId: z.string(),
      maxAmount: z.number(),
      allowedCategories: z.array(z.string()).optional(),
    },
    async (args) => {
      const res = await executeMCPTool("create_checkout_session", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "complete_checkout_session",
    "Execute ACP checkout completion and generate Razorpay payment order.",
    {
      checkoutSessionId: z.string(),
      mode: z.enum(["payment_link", "direct_capture"]).optional(),
    },
    async (args) => {
      const res = await executeMCPTool("complete_checkout_session", args);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  return server;
}
