import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { addToCart, getHydratedCart, removeFromCart } from "@/lib/cart";
import { getRecommendations } from "@/lib/agent/recommendations";
import { logAudit } from "@/lib/agent/audit";
import { embedText, isEmbeddingConfigured } from "@/lib/llm/client";
import { createCheckoutForSession, createDirectCheckoutForProduct } from "@/lib/commerce/checkout";

function sessionIdFrom(config: RunnableConfig): string {
  const sessionId = config.configurable?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("Missing sessionId in tool call context.");
  }
  return sessionId;
}

function formatPaiseToINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
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

    const queryEmbedding = isEmbeddingConfigured()
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
      priceInRupees: r.price / 100,
      priceFormatted: formatPaiseToINR(r.price),
      currency: "INR",
      category: r.category,
      inventory: r.inventory,
      imageUrl: r.imageUrl,
    }));

    await logAudit({
      sessionId,
      action: "SEARCH_PRODUCTS",
      input,
      output: {
        count: results.length,
        matches: results.map((r) => ({
          name: r.name,
          priceInRupees: r.priceInRupees,
          category: r.category,
          inventory: r.inventory,
        })),
      },
      explanation: `Searched catalog for "${query}"${
        maxPrice ? ` under ₹${maxPrice}` : ""
      }${category ? ` in ${category}` : ""}, found ${results.length} match(es).`,
    });

    if (results.length === 0) {
      return "No products found matching your search query.";
    }

    return JSON.stringify(results);
  },
  {
    name: "search_products",
    description:
      "Semantic + filtered search over the product catalog. Returns product list where priceInRupees is in standard INR Rupees (₹).",
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
      output: product
        ? {
            found: true,
            name: product.name,
            priceInRupees: product.price / 100,
            currency: "INR",
            category: product.category,
            inventory: product.inventory,
          }
        : { found: false },
      explanation: product
        ? `Fetched details for ${product.name} (₹${(product.price / 100).toFixed(2)}, stock: ${product.inventory}).`
        : `Product ${input.productId} was not found.`,
    });

    if (!product) return "Product not found.";
    return JSON.stringify({
      productId: product.id,
      name: product.name,
      description: product.description,
      priceInRupees: product.price / 100,
      priceFormatted: formatPaiseToINR(product.price),
      currency: "INR",
      category: product.category,
      inventory: product.inventory,
      imageUrl: product.imageUrl,
      variants: product.variants ?? [],
    });
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

    const recsFormatted = recs.map((r) => ({
      ...r,
      priceInRupees: r.price / 100,
      priceFormatted: formatPaiseToINR(r.price),
      currency: "INR",
    }));

    await logAudit({
      sessionId,
      action: "RECOMMEND",
      input,
      output: {
        count: recsFormatted.length,
        recommendations: recsFormatted.map((r) => ({
          name: r.name,
          priceInRupees: r.priceInRupees,
          confidencePct: Math.round(r.confidence * 100),
          supportPct: Math.round(r.support * 100),
          basedOnProduct: r.basedOnProductName,
        })),
      },
      explanation: recsFormatted.length
        ? recsFormatted
            .map(
              (r) =>
                `${r.name} (₹${r.priceInRupees}): ${Math.round(r.confidence * 100)}% of buyers with ${r.basedOnProductName} also bought this.`
            )
            .join(" ")
        : "No strong co-purchase patterns found for these products yet.",
    });

    if (recsFormatted.length === 0) {
      return "No co-purchase recommendations found for these products.";
    }

    return JSON.stringify(recsFormatted);
  },
  {
    name: "get_recommendations",
    description:
      "Given products already in the cart, return cross-sell / upsell suggestions ranked by purchase confidence and support (all prices in INR Rupees ₹).",
    schema: z.object({
      productIds: z.array(z.string()).describe("Product ids currently in the cart"),
    }),
  }
);

export const getCartTool = tool(
  async (_input, config) => {
    const sessionId = sessionIdFrom(config);
    const cart = await getHydratedCart(sessionId);

    const formattedCart = {
      items: cart.items.map((i) => ({
        ...i,
        priceInRupees: i.price / 100,
        priceFormatted: formatPaiseToINR(i.price),
        itemTotalInRupees: (i.price * i.quantity) / 100,
      })),
      totalAmountInRupees: cart.total / 100,
      totalFormatted: formatPaiseToINR(cart.total),
      currency: "INR",
    };

    await logAudit({
      sessionId,
      action: "GET_CART",
      output: {
        itemCount: cart.items.length,
        totalAmountInRupees: cart.total / 100,
        currency: "INR",
        items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, priceInRupees: i.price / 100 })),
      },
      explanation: `Checked cart: ${cart.items.length} item(s), total ₹${(cart.total / 100).toFixed(2)}.`,
    });

    return JSON.stringify(formattedCart);
  },
  {
    name: "get_cart",
    description: "Get the current shopping cart contents and total amount in INR Rupees (₹).",
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
      return JSON.stringify({ error: "Product not found" });
    }

    const existingCart = await getHydratedCart(sessionId);
    const existingInCart = existingCart.items.find((i) => i.productId === input.productId)?.quantity ?? 0;

    if (product.inventory < (existingInCart + input.quantity)) {
      return JSON.stringify({
        error: `Cannot add ${input.quantity} unit(s). You already have ${existingInCart} in cart, and only ${product.inventory} unit(s) of ${product.name} are available in stock.`,
      });
    }

    await addToCart(sessionId, input.productId, input.quantity, input.variantId);
    const cart = await getHydratedCart(sessionId);

    const formattedCart = {
      items: cart.items.map((i) => ({
        ...i,
        priceInRupees: i.price / 100,
        priceFormatted: formatPaiseToINR(i.price),
      })),
      totalAmountInRupees: cart.total / 100,
      totalFormatted: formatPaiseToINR(cart.total),
      currency: "INR",
    };

    await logAudit({
      sessionId,
      action: "ADD_TO_CART",
      input,
      output: {
        addedProduct: product.name,
        quantity: input.quantity,
        unitPriceInRupees: product.price / 100,
        cartTotalInRupees: cart.total / 100,
        totalItemsCount: cart.items.length,
      },
      explanation: `Added ${input.quantity} x ${product.name} (₹${(product.price / 100).toFixed(2)}) to cart.`,
    });

    return JSON.stringify(formattedCart);
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

    const formattedCart = {
      items: cart.items.map((i) => ({
        ...i,
        priceInRupees: i.price / 100,
        priceFormatted: formatPaiseToINR(i.price),
      })),
      totalAmountInRupees: cart.total / 100,
      totalFormatted: formatPaiseToINR(cart.total),
      currency: "INR",
    };

    await logAudit({
      sessionId,
      action: "REMOVE_FROM_CART",
      input,
      output: {
        removedProductId: input.productId,
        cartTotalInRupees: cart.total / 100,
        totalItemsCount: cart.items.length,
      },
      explanation: `Removed product ${input.productId} from cart.`,
    });

    return JSON.stringify(formattedCart);
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
    const checkout = await createCheckoutForSession(sessionId);
    return JSON.stringify(checkout);
  },
  {
    name: "create_checkout",
    description:
      "Create a Razorpay order for the customer's entire cart. Call this after the customer confirms checking out their cart.",
    schema: z.object({}),
  }
);

export const buyNowTool = tool(
  async (input, config) => {
    const sessionId = sessionIdFrom(config);
    const checkout = await createDirectCheckoutForProduct(
      sessionId,
      input.productId,
      input.quantity ?? 1,
      input.variantId
    );
    return JSON.stringify(checkout);
  },
  {
    name: "buy_now",
    description:
      "Instant Direct Buy Now for a specific product without modifying or emptying the customer's existing shopping cart. Call this when the customer wants to buy 1 item immediately.",
    schema: z.object({
      productId: z.string().describe("Product ID to buy immediately"),
      quantity: z.number().int().min(1).default(1).describe("Quantity to purchase"),
      variantId: z.string().optional().describe("Variant ID if applicable"),
    }),
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
  buyNowTool,
];
