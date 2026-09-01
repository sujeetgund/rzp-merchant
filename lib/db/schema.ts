import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  customType,
  pgEnum,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const customVector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value as number[];
  },
});

export const orderStatusEnum = pgEnum("order_status", [
  "created",
  "paid",
  "failed",
  "cancelled",
]);

export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH"]);

// Better Auth core tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  issuer: text("issuer"),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passkey = pgTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  webauthnUserID: text("webauthn_user_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  transports: text("transports"),
  createdAt: timestamp("created_at").defaultNow(),
  aaguid: text("aaguid"),
  credentialID: text("credential_id"),
});

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  policyConfig: jsonb("policy_config").notNull().default({
    maxDiscountPercent: 15,
    maxOrderAmountINR: 50000,
    requireApprovalAboveINR: 10000,
    allowedCategories: [],
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const merchantApiKeys = pgTable("merchant_api_keys", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull(),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(), // paise
    inventory: integer("inventory").notNull().default(0),
    category: varchar("category", { length: 128 }).notNull().default("General"),
    variants: jsonb("variants").$type<{ id: string; name: string; extraPrice?: number }[] | null>(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_category_idx").on(table.category),
    index("products_merchant_idx").on(table.merchantId),
  ]
);

export const productEmbeddings = pgTable("product_embeddings", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  embedding: customVector("embedding"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
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
    index("orders_user_idx").on(table.userId),
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
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // cs_...
    sessionId: varchar("session_id", { length: 128 }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"), // DRAFT | VALIDATED | PAID | FAILED
    amount: integer("amount").notNull(), // paise
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    items: jsonb("items").notNull().default([]),
    buyerMandate: jsonb("buyer_mandate"),
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }),
    paymentLink: text("payment_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("checkout_sessions_session_idx").on(table.sessionId)]
);

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

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export type User = typeof user.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type MerchantApiKey = typeof merchantApiKeys.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type NewCheckoutSession = typeof checkoutSessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
