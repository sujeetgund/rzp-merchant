import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPaise } from "@/lib/format";
import { StripeConsoleCard } from "@/components/merchant/StripeConsoleCard";
import { DollarSign, ShoppingBag, TrendingUp, ShieldAlert, Sparkles, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [summary] = await db.execute<{ revenue: string; order_count: string }>(sql`
    SELECT COALESCE(SUM(amount), 0)::text AS revenue, COUNT(*)::text AS order_count
    FROM orders WHERE status = 'paid'
  `);

  const [aiActionsCount] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM audit_logs
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
    LIMIT 6
  `);

  const recentOrders = await db.execute<{
    id: string;
    razorpay_order_id: string;
    amount: string;
    status: string;
    created_at: Date;
    user_name: string | null;
    user_email: string | null;
  }>(sql`
    SELECT o.id, o.razorpay_order_id, o.amount::text, o.status, o.created_at, u.name AS user_name, u.email AS user_email
    FROM orders o
    LEFT JOIN "user" u ON u.id = o.user_id
    WHERE o.status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 6
  `);

  const revenue = Number(summary?.revenue ?? 0);
  const orderCount = Number(summary?.order_count ?? 0);
  const aov = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  return {
    revenue,
    orderCount,
    aov,
    aiActionsCount: Number(aiActionsCount?.count ?? 0),
    topProducts: topProducts.map((r) => ({
      name: r.name,
      unitsSold: Number(r.units_sold),
      revenue: Number(r.revenue),
    })),
    recentOrders: recentOrders.map((r) => ({
      id: r.id,
      razorpayOrderId: r.razorpay_order_id,
      amount: Number(r.amount),
      status: r.status,
      createdAt: r.created_at,
      userName: r.user_name || "Customer",
      userEmail: r.user_email || "Direct Storefront",
    })),
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] min-h-0 overflow-y-auto space-y-5 pr-1">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Merchant Control Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of revenue, order activity, and sales performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Store Live · INR (₹)</span>
          </Badge>
        </div>
      </div>

      {/* Top 4 Key Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total Revenue</span>
              <DollarSign className="size-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {formatPaise(stats.revenue)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Settled paid orders</p>
          </CardContent>
        </Card>

        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Paid Orders</span>
              <ShoppingBag className="size-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {stats.orderCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Completed checkouts</p>
          </CardContent>
        </Card>

        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Average Order Value</span>
              <TrendingUp className="size-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {formatPaise(stats.aov)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Revenue per checkout</p>
          </CardContent>
        </Card>

        <Card className="border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>AI Operations</span>
              <Sparkles className="size-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {stats.aiActionsCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Actions logged</span>
              <Link href="/dashboard/agent-activity" className="text-primary hover:underline font-medium flex items-center gap-0.5">
                <span>View</span>
                <ArrowUpRight className="size-3" />
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Orders + Products + Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* Left Column: Recent Orders Table */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="border shadow-2xs">
            <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Latest completed customer checkouts</p>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/orders" />} nativeButton={false} className="h-7 text-xs gap-1">
                <span>View All Orders</span>
                <ArrowUpRight className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{order.userName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{order.razorpayOrderId}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-xs tabular-nums">{formatPaise(order.amount)}</p>
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-1.5 py-0">
                        PAID
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stripe Developer Console Composite Card */}
          <StripeConsoleCard />
        </div>

        {/* Right Column: Top Products */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border shadow-2xs">
            <CardHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top Products by Revenue</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Best performing catalog items</p>
              </div>
              <TrendingUp className="size-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4">
              {stats.topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No order items recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.topProducts.map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-mono font-bold">
                          {idx + 1}
                        </span>
                        <span className="truncate font-medium text-xs">{p.name}</span>
                      </div>
                      <div className="shrink-0 text-right font-mono tabular-nums text-xs">
                        <span className="font-bold">{formatPaise(p.revenue)}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">({p.unitsSold} sold)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
