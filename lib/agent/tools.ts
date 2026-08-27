import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { addToCart, getHydratedCart, removeFromCart } from "@/lib/cart";
import { getRecommendations } from "@/lib/agent/recommendations";
import { logAudit } from "@/lib/agent/audit";
import { embedText, isLlmConfigured } from "@/lib/llm/client";
import { createCheckoutForSession } from "@/lib/commerce/checkout";

function sessionIdFrom(config: RunnableConfig): string {
  const sessionId = config.configurable?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("Missing sessionId in tool call context.");
  }
  return sessionId;
}

export const searchProductsTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    const { query, maxPrice, category } = input;

    const conditions = [];
    if (typeof maxPrice === "number") {
      conditions.push(sql`p.price <= ${Math.round(maxPrice * 100)}`);
    }
    if (category) {
      conditions.push(sql`p.category ILIKE ${category}`);
    }
    const whereSql = conditions.length
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    let rows: {
      id: string;
      name: string;
      description: string;
      price: number;
      category: string;
      inventory: number;
      imageUrl: string | null;
    }[];

    const queryEmbedding = isLlmConfigured()
      ? await embedText(query).catch(() => null)
      : null;

    if (queryEmbedding) {
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;
      rows = await db.execute(sql`
        SELECT p.id, p.name, p.description, p.price, p.category, p.inventory,
               p.image_url AS "imageUrl"
        FROM products p
        LEFT JOIN product_embeddings pe ON pe.product_id = p.id
        ${whereSql}
        ORDER BY (pe.embedding IS NULL) ASC, pe.embedding <=> ${vectorLiteral}::vector ASC, p.name ASC
        LIMIT 10
      `);
    } else {
      const keywordConditions = [
        ...conditions,
        sql`(p.name ILIKE ${"%" + query + "%"} OR p.description ILIKE ${"%" + query + "%"})`,
      ];
      rows = await db.execute(sql`
        SELECT p.id, p.name, p.description, p.price, p.category, p.inventory,
               p.image_url AS "imageUrl"
        FROM products p
        WHERE ${sql.join(keywordConditions, sql` AND `)}
        ORDER BY p.name ASC
        LIMIT 10
      `);
    }

    const results = rows.map((r) => ({
      productId: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      category: r.category,
      inventory: r.inventory,
      imageUrl: r.imageUrl,
    }));

    await logAudit({
      sessionId,
      action: "SEARCH_PRODUCTS",
      input,
      output: { count: results.length },
      explanation: `Searched catalog for "${query}"${
        maxPrice ? ` under ₹${maxPrice}` : ""
      }${category ? ` in ${category}` : ""}, found ${results.length} match(es).`,
    });

    return results;
  },
  {
    name: "search_products",
    description:
      "Semantic + filtered search over the product catalog. Use this to find products matching what the customer is asking for.",
    schema: z.object({
      query: z.string().describe("What the customer is looking for, in natural language"),
      maxPrice: z.number().optional().describe("Maximum price in INR (rupees, not paise)"),
      category: z.string().optional().describe("Category to filter by, if known"),
    }),
  }
);

export const getProductTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    await logAudit({
      sessionId,
      action: "GET_PRODUCT",
      input,
      output: product ? { found: true } : { found: false },
      explanation: product
        ? `Fetched details for ${product.name}.`
        : `Product ${input.productId} was not found.`,
    });

    if (!product) return { error: "Product not found" };
    return {
      productId: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      inventory: product.inventory,
      imageUrl: product.imageUrl,
      variants: product.variants ?? [],
    };
  },
  {
    name: "get_product",
    description: "Get full details and current inventory for a single product by id.",
    schema: z.object({ productId: z.string().describe("Product id") }),
  }
);

export const getRecommendationsTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    const recs = await getRecommendations(input.productIds, 5);

    await logAudit({
      sessionId,
      action: "RECOMMEND",
      input,
      output: { count: recs.length },
      explanation: recs.length
        ? recs
            .map(
              (r) =>
                `${r.name}: ${Math.round(r.confidence * 100)}% of orders with ${r.basedOnProductName} also include this (support ${Math.round(
                  r.support * 100
                )}%).`
            )
            .join(" ")
        : "No strong co-purchase patterns found for these products yet.",
    });

    return recs;
  },
  {
    name: "get_recommendations",
    description:
      "Given products already in the cart, return cross-sell / upsell suggestions ranked by purchase confidence and support (how often they're bought together historically).",
    schema: z.object({
      productIds: z.array(z.string()).describe("Product ids currently in the cart"),
    }),
  }
);

export const getCartTool = tool(
  async (_input, config) => {
    const sessionId = sessionIdFrom(config);
    const cart = await getHydratedCart(sessionId);

    await logAudit({
      sessionId,
      action: "GET_CART",
      output: { itemCount: cart.items.length, total: cart.total },
      explanation: `Checked cart: ${cart.items.length} item(s), total ₹${(cart.total / 100).toFixed(2)}.`,
    });

    return cart;
  },
  {
    name: "get_cart",
    description: "Get the current shopping cart contents and total for this conversation.",
    schema: z.object({}),
  }
);

export const addToCartTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (!product) {
      return { error: "Product not found" };
    }
    if (product.inventory < input.quantity) {
      return {
        error: `Only ${product.inventory} unit(s) of ${product.name} in stock`,
      };
    }

    await addToCart(sessionId, input.productId, input.quantity, input.variantId);
    const cart = await getHydratedCart(sessionId);

    await logAudit({
      sessionId,
      action: "ADD_TO_CART",
      input,
      output: { cartTotal: cart.total, itemCount: cart.items.length },
      explanation: `Added ${input.quantity} x ${product.name} to cart.`,
    });

    return cart;
  },
  {
    name: "add_to_cart",
    description: "Add a product (optionally a specific variant) to the customer's cart.",
    schema: z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).default(1),
      variantId: z.string().optional(),
    }),
  }
);

export const removeFromCartTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    await removeFromCart(sessionId, input.productId, input.variantId);
    const cart = await getHydratedCart(sessionId);

    await logAudit({
      sessionId,
      action: "REMOVE_FROM_CART",
      input,
      output: { cartTotal: cart.total, itemCount: cart.items.length },
      explanation: `Removed product ${input.productId} from cart.`,
    });

    return cart;
  },
  {
    name: "remove_from_cart",
    description: "Remove a product from the customer's cart.",
    schema: z.object({
      productId: z.string(),
      variantId: z.string().optional(),
    }),
  }
);

export const createCheckoutTool = tool(
  async (_input, config) => {
    const sessionId = sessionIdFrom(config);
    return createCheckoutForSession(sessionId);
  },
  {
    name: "create_checkout",
    description:
      "Create a Razorpay order for the current cart so the customer can pay. Call this only after the customer confirms they want to check out.",
    schema: z.object({}),
  }
);

export const commerceTools = [
  searchProductsTool,
  getProductTool,
  getRecommendationsTool,
  getCartTool,
  addToCartTool,
  removeFromCartTool,
  createCheckoutTool,
];
