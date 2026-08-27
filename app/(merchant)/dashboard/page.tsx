import { sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPaise } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getStats() {
  const [summary] = await db.execute<{ revenue: string; order_count: string }>(sql`
    SELECT COALESCE(SUM(amount), 0)::text AS revenue, COUNT(*)::text AS order_count
    FROM orders WHERE status = 'paid'
  `);

  const topProducts = await db.execute<{
    name: string;
    units_sold: string;
    revenue: string;
  }>(sql`
    SELECT p.name, SUM(oi.quantity)::text AS units_sold, SUM(oi.quantity * oi.price)::text AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid'
    GROUP BY p.name
    ORDER BY SUM(oi.quantity * oi.price) DESC
    LIMIT 5
  `);

  return {
    revenue: Number(summary?.revenue ?? 0),
    orderCount: Number(summary?.order_count ?? 0),
    topProducts: topProducts.map((r) => ({
      name: r.name,
      unitsSold: Number(r.units_sold),
      revenue: Number(r.revenue),
    })),
  };
}

export default async function DashboardPage() {
  const [stats, recentLogs] = await Promise.all([
    getStats(),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(15),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your store&apos;s performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatPaise(stats.revenue)}</p>
            <p className="text-xs text-muted-foreground">From paid orders (test mode)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.orderCount}</p>
            <p className="text-xs text-muted-foreground">Completed payments</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <ul className="divide-y">
              {stats.topProducts.map((p) => (
                <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {p.unitsSold} sold · {formatPaise(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agent activity yet — chat with the AI Salesman on the storefront to see it here.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{log.action}</span>
                      <Badge
                        variant={
                          log.riskLevel === "HIGH"
                            ? "destructive"
                            : log.riskLevel === "MEDIUM"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {log.riskLevel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{log.explanation}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {log.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
