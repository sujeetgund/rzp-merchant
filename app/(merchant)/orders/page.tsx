import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPaise } from "@/lib/format";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  created: "secondary",
  authorized: "secondary",
  failed: "destructive",
  cancelled: "outline",
};

interface OrderWithItemsRow {
  [key: string]: unknown;
  id: string;
  sessionId: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  itemSummary: string;
  itemCount: number;
}

interface OrdersPageProps {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 15;

async function getPaginatedOrders(page: number, pageSize: number) {
  const [countResult] = await db.execute<{ total: string }>(
    sql`SELECT COUNT(*)::text AS total FROM orders`
  );
  const totalOrders = Number(countResult?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * pageSize;

  const rows = await db.execute<OrderWithItemsRow>(sql`
    SELECT
      o.id,
      o.session_id AS "sessionId",
      o.razorpay_order_id AS "razorpayOrderId",
      o.razorpay_payment_id AS "razorpayPaymentId",
      o.amount,
      o.currency,
      o.status,
      o.created_at::text AS "createdAt",
      COALESCE(
        STRING_AGG(p.name || ' (x' || oi.quantity || ')', ', '),
        'No items'
      ) AS "itemSummary",
      COALESCE(SUM(oi.quantity), 0)::int AS "itemCount"
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const ordersList = rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    itemCount: Number(r.itemCount),
  }));

  return {
    orders: ordersList,
    totalOrders,
    totalPages,
    currentPage,
    pageSize,
    offset,
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const pageParam = parseInt(params.page ?? "1", 10);
  const currentPage = isNaN(pageParam) ? 1 : pageParam;

  const { orders: ordersList, totalOrders, totalPages, offset } = await getPaginatedOrders(
    currentPage,
    PAGE_SIZE
  );

  const startRange = totalOrders === 0 ? 0 : offset + 1;
  const endRange = Math.min(offset + PAGE_SIZE, totalOrders);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer transactions, settlements, and item fulfillments ({totalOrders} total orders).
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 border shadow-2xs">
          <ShoppingCart className="size-4 text-primary" />
          <span className="text-xs font-semibold">{totalOrders} Settled Orders</span>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="rounded-xl border bg-card shadow-2xs overflow-hidden flex flex-col">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-semibold">Razorpay Order ID</TableHead>
              <TableHead className="font-semibold">Items Purchased</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Session ID</TableHead>
              <TableHead className="font-semibold text-right">Created Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No orders found in database.
                </TableCell>
              </TableRow>
            ) : (
              ordersList.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-xs font-medium">
                    {order.razorpayOrderId ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs font-medium">
                    {order.itemSummary}
                  </TableCell>
                  <TableCell className="font-semibold text-xs">{formatPaise(order.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? "outline"} className="capitalize text-[10px]">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.sessionId.length > 18
                      ? `${order.sessionId.slice(0, 16)}...`
                      : order.sessionId}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-mono">
                    {new Date(order.createdAt).toLocaleString("en-US", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
          <div className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-semibold text-foreground">{startRange}</span> to{" "}
            <span className="font-semibold text-foreground">{endRange}</span> of{" "}
            <span className="font-semibold text-foreground">{totalOrders}</span> orders
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium mr-2">
              Page {currentPage} of {totalPages}
            </span>

            {/* Previous Page Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              render={currentPage > 1 ? <Link href={`/orders?page=${currentPage - 1}`} /> : undefined}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>

            {/* Next Page Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              render={currentPage < totalPages ? <Link href={`/orders?page=${currentPage + 1}`} /> : undefined}
              className="h-8 gap-1 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
