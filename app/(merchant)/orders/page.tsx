import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPaise } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  created: "secondary",
  authorized: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

export default async function OrdersPage() {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  const allOrders = rows.filter((o) => !o.sessionId.startsWith("synthetic-"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-muted-foreground">Most recent 100 orders.</p>
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razorpay Order</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              allOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    {order.razorpayOrderId ?? "—"}
                  </TableCell>
                  <TableCell>{formatPaise(order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.sessionId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.createdAt.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
