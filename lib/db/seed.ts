import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { merchants, orderItems, orders, productEmbeddings, products } from "@/lib/db/schema";
import { embedText, isEmbeddingConfigured } from "@/lib/llm/client";

// Seeded PRNG for repeatable database seeding
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function chance(p: number): boolean {
  return rand() < p;
}

const CATALOG = [
  {
    key: "running_shoes",
    name: "Trailblaze Running Shoes",
    description:
      "Lightweight everyday running shoes with breathable mesh upper and cushioned sole. Great for road running and daily training.",
    price: 249900,
    category: "Footwear",
    inventory: 60,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
    variants: [
      { id: "uk7", name: "UK 7" },
      { id: "uk8", name: "UK 8" },
      { id: "uk9", name: "UK 9" },
      { id: "uk10", name: "UK 10" },
    ],
  },
  {
    key: "urban_sneakers",
    name: "Urban Sneakers",
    description: "Minimalist everyday sneakers built for comfort on city streets, pairs well with casual outfits.",
    price: 299900,
    category: "Footwear",
    inventory: 45,
    imageUrl: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800",
    variants: [
      { id: "uk7", name: "UK 7" },
      { id: "uk8", name: "UK 8" },
      { id: "uk9", name: "UK 9" },
    ],
  },
  {
    key: "leather_loafers",
    name: "Classic Leather Loafers",
    description: "Handcrafted genuine leather loafers for formal and semi-formal occasions.",
    price: 349900,
    category: "Footwear",
    inventory: 30,
    imageUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800",
    variants: null,
  },
  {
    key: "sports_tshirt",
    name: "Dri-Fit Sports T-Shirt",
    description: "Moisture-wicking performance t-shirt, breathable fabric for workouts and running.",
    price: 79900,
    category: "Apparel",
    inventory: 120,
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
    variants: [
      { id: "s", name: "S" },
      { id: "m", name: "M" },
      { id: "l", name: "L" },
      { id: "xl", name: "XL" },
    ],
  },
  {
    key: "running_shorts",
    name: "Performance Running Shorts",
    description: "Lightweight quick-dry running shorts with a zip pocket, built for training days.",
    price: 89900,
    category: "Apparel",
    inventory: 100,
    imageUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800",
    variants: [
      { id: "s", name: "S" },
      { id: "m", name: "M" },
      { id: "l", name: "L" },
    ],
  },
  {
    key: "fleece_hoodie",
    name: "Cozy Fleece Hoodie",
    description: "Warm brushed-fleece hoodie for post-workout comfort or everyday wear.",
    price: 179900,
    category: "Apparel",
    inventory: 70,
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800",
    variants: [
      { id: "m", name: "M" },
      { id: "l", name: "L" },
      { id: "xl", name: "XL" },
    ],
  },
  {
    key: "performance_socks",
    name: "Performance Socks (3-Pack)",
    description: "Cushioned, moisture-wicking sports socks. Sold as a pack of 3 pairs.",
    price: 39900,
    category: "Accessories",
    inventory: 200,
    imageUrl: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800",
    variants: null,
  },
  {
    key: "sports_cap",
    name: "Sports Cap",
    description: "Adjustable lightweight cap with UV protection, ideal for running and outdoor sports.",
    price: 49900,
    category: "Accessories",
    inventory: 150,
    imageUrl: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800",
    variants: null,
  },
  {
    key: "duffel_bag",
    name: "Gym Duffel Bag",
    description: "Spacious water-resistant duffel bag with a dedicated shoe compartment.",
    price: 129900,
    category: "Accessories",
    inventory: 55,
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
    variants: null,
  },
  {
    key: "wireless_earbuds",
    name: "Wireless Earbuds",
    description: "Sweat-resistant true wireless earbuds with 24-hour battery life via charging case.",
    price: 199900,
    category: "Electronics",
    inventory: 80,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800",
    variants: null,
  },
  {
    key: "fitness_tracker",
    name: "Fitness Tracker Band",
    description: "Tracks heart rate, sleep, and workouts with a week-long battery life.",
    price: 229900,
    category: "Electronics",
    inventory: 65,
    imageUrl: "https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=800",
    variants: null,
  },
  {
    key: "bt_speaker",
    name: "Portable Bluetooth Speaker",
    description: "Compact splash-proof speaker with punchy bass, perfect for the gym or outdoors.",
    price: 159900,
    category: "Electronics",
    inventory: 50,
    imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800",
    variants: null,
  },
  {
    key: "yoga_mat",
    name: "Non-Slip Yoga Mat",
    description: "Extra-thick non-slip yoga mat with carry strap, great for yoga and home workouts.",
    price: 89900,
    category: "Home & Living",
    inventory: 90,
    imageUrl: "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=800",
    variants: null,
  },
  {
    key: "water_bottle",
    name: "Insulated Steel Water Bottle",
    description: "Double-wall insulated bottle, keeps drinks cold for 24 hours or hot for 12.",
    price: 59900,
    category: "Home & Living",
    inventory: 180,
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800",
    variants: null,
  },
  {
    key: "dumbbell_set",
    name: "Adjustable Dumbbell Set",
    description: "Space-saving adjustable dumbbell pair, 2.5kg to 24kg per side.",
    price: 399900,
    category: "Home & Living",
    inventory: 25,
    imageUrl: "https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=800",
    variants: null,
  },
] as const;

const ALL_KEYS = CATALOG.map((p) => p.key);

async function main() {
  console.log("Seeding database...");

  await sqlClient`
    TRUNCATE TABLE order_items, orders, product_embeddings, products, merchants
    RESTART IDENTITY CASCADE
  `;

  await db.insert(merchants).values({ name: "Demo Merchant", currency: "INR" });

  const inserted = await db
    .insert(products)
    .values(
      CATALOG.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        inventory: p.inventory,
        imageUrl: p.imageUrl,
        variants: p.variants ? [...p.variants] : null,
      }))
    )
    .returning();
  const idByKey = new Map<string, string>(CATALOG.map((p, i) => [p.key, inserted[i].id]));
  console.log(`Inserted ${inserted.length} products.`);

  if (isEmbeddingConfigured()) {
    console.log("Generating product embeddings...");
    for (const p of CATALOG) {
      try {
        const embedding = await embedText(
          `${p.name}. ${p.description}. Category: ${p.category}.`
        );
        await db.insert(productEmbeddings).values({
          productId: idByKey.get(p.key)!,
          embedding,
        });
      } catch (err) {
        console.warn(`  Skipped embedding for ${p.name}:`, (err as Error).message);
      }
    }
  } else {
    console.log(
      "EMBEDDING_API_KEY not set — skipping embeddings. search_products will fall back to keyword search."
    );
  }

  console.log("Seeding 500 realistic historical orders...");
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 500; i++) {
    const cartKeys = new Set<string>();

    // 1. Pick a primary item
    const mainKey = pick(ALL_KEYS);
    cartKeys.add(mainKey);
    const mainProduct = CATALOG.find((p) => p.key === mainKey)!;

    // 2. Simulate natural cross-category basket additions
    if (mainProduct.category === "Footwear") {
      if (chance(0.45)) cartKeys.add("performance_socks");
      if (chance(0.35)) cartKeys.add("running_shorts");
      if (chance(0.25)) cartKeys.add("sports_tshirt");
    } else if (mainProduct.category === "Apparel") {
      if (chance(0.40)) cartKeys.add("running_shorts");
      if (chance(0.35)) cartKeys.add("performance_socks");
      if (chance(0.25)) cartKeys.add("water_bottle");
    } else if (mainProduct.category === "Electronics") {
      if (chance(0.40)) cartKeys.add("fitness_tracker");
      if (chance(0.30)) cartKeys.add("water_bottle");
    } else if (mainProduct.category === "Home & Living") {
      if (chance(0.45)) cartKeys.add("water_bottle");
      if (chance(0.25)) cartKeys.add("fitness_tracker");
    } else if (mainProduct.category === "Accessories") {
      if (chance(0.35)) cartKeys.add("dumbbell_set");
      if (chance(0.30)) cartKeys.add("performance_socks");
    }

    // 3. Occasional additional random item
    if (chance(0.15)) {
      cartKeys.add(pick(ALL_KEYS));
    }

    const items = [...cartKeys].map((key) => {
      const product = CATALOG.find((p) => p.key === key)!;
      const isApparel = product.category === "Apparel" || product.category === "Accessories";
      const quantity = isApparel && chance(0.25) ? 2 : 1;
      return {
        productId: idByKey.get(key)!,
        quantity,
        price: product.price,
      };
    });

    const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const createdAt = new Date(now - Math.floor(rand() * ninetyDaysMs));

    const orderNum = String(i + 1001).padStart(5, "0");
    const [order] = await db
      .insert(orders)
      .values({
        sessionId: `sess_hist_${orderNum}`,
        razorpayOrderId: `order_rzp_${orderNum}`,
        razorpayPaymentId: `pay_rzp_${orderNum}`,
        amount,
        currency: "INR",
        status: "paid",
        idempotencyKey: `idemp_hist_${orderNum}`,
        createdAt,
        updatedAt: createdAt,
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
  }

  const [{ count }] = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM orders WHERE status = 'paid'`
  );
  console.log(`Done. ${count} paid orders seeded across ${inserted.length} products.`);
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
