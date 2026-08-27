import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export interface Recommendation {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  inventory: number;
  support: number; // orders(A∩B) / total_orders
  confidence: number; // orders(A∩B) / orders(A)
  basedOnProductId: string;
  basedOnProductName: string;
}

/**
 * Market-basket association mining over paid orders. Pure SQL arithmetic —
 * no ML library needed at this catalog scale (see implementation_plan.md).
 */
export async function getRecommendations(
  productIds: string[],
  limit = 5
): Promise<Recommendation[]> {
  if (productIds.length === 0) return [];

  const totalOrdersResult = await db.execute<{ total: string }>(
    sql`SELECT COUNT(DISTINCT id) AS total FROM orders WHERE status = 'paid'`
  );
  const totalOrders = Number(totalOrdersResult.at(0)?.total ?? 0);
  if (totalOrders === 0) return [];

  const rows = await db.execute<{
    based_on_product_id: string;
    based_on_product_name: string;
    candidate_product_id: string;
    co_occurrence: string;
    orders_with_a: string;
  }>(sql`
    SELECT
      a.product_id AS based_on_product_id,
      pa.name AS based_on_product_name,
      b.product_id AS candidate_product_id,
      COUNT(DISTINCT a.order_id) AS co_occurrence,
      (
        SELECT COUNT(DISTINCT oi.order_id)
        FROM order_items oi
        JOIN orders o2 ON o2.id = oi.order_id
        WHERE oi.product_id = a.product_id AND o2.status = 'paid'
      ) AS orders_with_a
    FROM order_items a
    JOIN order_items b ON a.order_id = b.order_id AND b.product_id != a.product_id
    JOIN orders o ON o.id = a.order_id
    JOIN products pa ON pa.id = a.product_id
    WHERE o.status = 'paid'
      AND a.product_id IN ${sql`(${sql.join(
        productIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})`}
      AND b.product_id NOT IN ${sql`(${sql.join(
        productIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})`}
    GROUP BY a.product_id, pa.name, b.product_id
    ORDER BY co_occurrence DESC
  `);

  if (rows.length === 0) return [];

  const candidateIds = [...new Set(rows.map((r) => r.candidate_product_id))];
  const candidateProducts = await db
    .select()
    .from(products)
    .where(inArray(products.id, candidateIds));
  const productById = new Map(candidateProducts.map((p) => [p.id, p]));

  const scored: Recommendation[] = [];
  for (const row of rows) {
    const candidate = productById.get(row.candidate_product_id);
    if (!candidate) continue;
    const coOccurrence = Number(row.co_occurrence);
    const ordersWithA = Number(row.orders_with_a);
    scored.push({
      productId: candidate.id,
      name: candidate.name,
      price: candidate.price,
      imageUrl: candidate.imageUrl,
      inventory: candidate.inventory,
      support: coOccurrence / totalOrders,
      confidence: ordersWithA > 0 ? coOccurrence / ordersWithA : 0,
      basedOnProductId: row.based_on_product_id,
      basedOnProductName: row.based_on_product_name,
    });
  }

  // Keep the strongest signal per candidate product (highest confidence).
  const bestPerCandidate = new Map<string, Recommendation>();
  for (const rec of scored) {
    const existing = bestPerCandidate.get(rec.productId);
    if (!existing || rec.confidence > existing.confidence) {
      bestPerCandidate.set(rec.productId, rec);
    }
  }

  return [...bestPerCandidate.values()]
    .sort((a, b) => b.confidence - a.confidence || b.support - a.support)
    .slice(0, limit);
}
