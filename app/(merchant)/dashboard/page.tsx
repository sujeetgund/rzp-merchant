import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, agentSessions } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPaise } from "@/lib/format";
import { AgentActivityTrail } from "@/components/merchant/AgentActivityTrail";
import { StripeConsoleCard } from "@/components/merchant/StripeConsoleCard";
import type { SessionActivityGroup } from "@/app/api/merchant/agent-activity/stream/route";
import { DollarSign, ShoppingBag, TrendingUp, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    LIMIT 6
  `);

  const [highRiskCount] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM audit_logs WHERE risk_level = 'HIGH'
  `);

  return {
    revenue: Number(summary?.revenue ?? 0),
    orderCount: Number(summary?.order_count ?? 0),
    highRiskLogsCount: Number(highRiskCount?.count ?? 0),
    topProducts: topProducts.map((r) => ({
      name: r.name,
      unitsSold: Number(r.units_sold),
      revenue: Number(r.revenue),
    })),
  };
}

async function getInitialSessionGroups(): Promise<SessionActivityGroup[]> {
  const logs = await db
    .select({
      id: auditLogs.id,
      sessionId: auditLogs.sessionId,
      action: auditLogs.action,
      input: auditLogs.input,
      output: auditLogs.output,
      explanation: auditLogs.explanation,
      riskLevel: auditLogs.riskLevel,
      createdAt: auditLogs.createdAt,
      sessionCreatedAt: agentSessions.createdAt,
      sessionLastActiveAt: agentSessions.lastActiveAt,
    })
    .from(auditLogs)
    .leftJoin(agentSessions, eq(auditLogs.sessionId, agentSessions.sessionId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  const groupMap = new Map<string, SessionActivityGroup>();

  for (const log of logs) {
    let group = groupMap.get(log.sessionId);
    if (!group) {
      group = {
        sessionId: log.sessionId,
        lastActiveAt: (log.sessionLastActiveAt ?? log.createdAt).toISOString(),
        createdAt: (log.sessionCreatedAt ?? log.createdAt).toISOString(),
        activities: [],
      };
      groupMap.set(log.sessionId, group);
    }
    group.activities.push({
      id: log.id,
      sessionId: log.sessionId,
      action: log.action,
      input: log.input,
      output: log.output,
      explanation: log.explanation,
      riskLevel: log.riskLevel,
      createdAt: log.createdAt.toISOString(),
    });
  }

  return Array.from(groupMap.values());
}

export default async function DashboardPage() {
  const [stats, initialGroups] = await Promise.all([
    getStats(),
    getInitialSessionGroups(),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] min-h-0 overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Merchant Control Center</h1>
          <p className="text-xs text-muted-foreground">
            Linear Merchant OS · Financial Infrastructure & Autonomous Telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
            <ShieldCheck className="size-3" />
            <span>AGENT POLICY: MAX 15% DISCOUNT</span>
          </Badge>
        </div>
      </div>

      {/* Main Grid: Single-Screen Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Left-most Column: Live Timestamped Agent Trail (Internal scroll inside card) */}
        <div className="lg:col-span-7 xl:col-span-7 h-full flex flex-col min-h-0 overflow-hidden">
          <AgentActivityTrail initialGroups={initialGroups} />
        </div>

        {/* Right Column: Key Financial Metrics, Developer Console & Top Products */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-5 h-full flex flex-col min-h-0 overflow-y-auto pr-1">
          {/* Key Financial Metrics (Stripe tnum format) */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <Card className="border shadow-2xs">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Total Revenue</span>
                  <DollarSign className="size-3.5 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xl font-bold tracking-tight font-mono tabular-nums text-foreground">
                  {formatPaise(stats.revenue)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Settled paid orders</p>
              </CardContent>
            </Card>

            <Card className="border shadow-2xs">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Paid Orders</span>
                  <ShoppingBag className="size-3.5 text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xl font-bold tracking-tight font-mono tabular-nums text-foreground">
                  {stats.orderCount}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Completed checkouts</p>
              </CardContent>
            </Card>
          </div>

          {/* Stripe Developer Console Composite IDE Card */}
          <StripeConsoleCard />

          {/* High Risk Events Metric */}
          <Card className="border shadow-2xs bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 shrink-0">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                <span>Agent Risk Telemetry</span>
                <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-lg font-bold font-mono tabular-nums text-amber-800 dark:text-amber-300">
                {stats.highRiskLogsCount} High-Risk Flags
              </p>
              <p className="mt-0.5 text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                Autonomous AI execution threshold breaches or custom checkouts.
              </p>
            </CardContent>
          </Card>

          {/* Top Selling Products */}
          <Card className="border shadow-2xs shrink-0">
            <CardHeader className="p-3 pb-2 border-b">
              <CardTitle className="flex items-center justify-between text-xs font-semibold">
                <span>Top Products by Revenue</span>
                <TrendingUp className="size-3.5 text-emerald-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {stats.topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No order items recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.topProducts.map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="flex size-4.5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-mono font-bold">
                          {idx + 1}
                        </span>
                        <span className="truncate font-medium text-[11px]">{p.name}</span>
                      </div>
                      <div className="shrink-0 text-right font-mono tabular-nums text-[11px]">
                        <span className="font-semibold">{formatPaise(p.revenue)}</span>
                        <span className="ml-1 text-[9px] text-muted-foreground">({p.unitsSold})</span>
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
