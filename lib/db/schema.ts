import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const EMBEDDING_DIMENSIONS = 1536;

const vector = customType<{ data: number[]; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value as number[];
    const raw = String(value);
    return raw
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

export const orderStatusEnum = pgEnum("order_status", [
  "created",
  "authorized",
  "paid",
  "failed",
  "cancelled",
]);

export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH"]);

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().default("Demo Merchant"),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(), // paise
    inventory: integer("inventory").notNull().default(0),
    category: varchar("category", { length: 100 }).notNull(),
    variants: jsonb("variants").$type<{ id: string; name: string; extraPrice?: number }[]>(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_category_idx").on(table.category),
    index("products_name_idx").on(table.name),
  ]
);

export const productEmbeddings = pgTable("product_embeddings", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 64 }),
    amount: integer("amount").notNull(), // paise
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    status: orderStatusEnum("status").notNull().default("created"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull().unique(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_session_idx").on(table.sessionId),
    index("orders_razorpay_order_idx").on(table.razorpayOrderId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: varchar("variant_id", { length: 64 }),
    quantity: integer("quantity").notNull().default(1),
    price: integer("price").notNull(), // paise, unit price at time of order
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_product_idx").on(table.productId),
  ]
);

export const agentSessions = pgTable("agent_sessions", {
  sessionId: varchar("session_id", { length: 128 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    explanation: text("explanation").notNull().default(""),
    riskLevel: riskLevelEnum("risk_level").notNull().default("LOW"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_session_idx").on(table.sessionId)]
);

export const productsRelations = relations(products, ({ one, many }) => ({
  embedding: one(productEmbeddings, {
    fields: [products.id],
    references: [productEmbeddings.productId],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export type Merchant = typeof merchants.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
