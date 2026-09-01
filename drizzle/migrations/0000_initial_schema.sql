-- Consolidated Clean Drizzle Migration 0000: Initial Schema Definition

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

DO $$ BEGIN
  CREATE TYPE "public"."order_status" AS ENUM('created', 'paid', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issuer" text
);

CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
	"webauthn_user_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT now(),
	"aaguid" text,
	"credential_id" text
);

CREATE TABLE IF NOT EXISTS "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL UNIQUE,
	"policy_config" jsonb DEFAULT '{"maxDiscountPercent": 15, "maxOrderAmountINR": 50000, "allowedCategories": [], "requireApprovalAboveINR": 10000}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "merchant_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid REFERENCES "public"."merchants"("id") ON DELETE cascade,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"inventory" integer DEFAULT 0 NOT NULL,
	"category" varchar(128) DEFAULT 'General' NOT NULL,
	"variants" jsonb,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category");
CREATE INDEX IF NOT EXISTS "products_merchant_idx" ON "products" ("merchant_id");

CREATE TABLE IF NOT EXISTS "product_embeddings" (
	"product_id" uuid PRIMARY KEY REFERENCES "public"."products"("id") ON DELETE cascade NOT NULL,
	"embedding" vector(1536),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"user_id" text REFERENCES "public"."user"("id") ON DELETE set null,
	"razorpay_order_id" varchar(64),
	"razorpay_payment_id" varchar(64),
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"status" "public"."order_status" DEFAULT 'created' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL UNIQUE,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "orders_session_idx" ON "orders" ("session_id");
CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "orders" ("user_id");
CREATE INDEX IF NOT EXISTS "orders_razorpay_order_idx" ON "orders" ("razorpay_order_id");

CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL REFERENCES "public"."orders"("id") ON DELETE cascade,
	"product_id" uuid NOT NULL REFERENCES "public"."products"("id") ON DELETE restrict,
	"variant_id" varchar(64),
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_idx" ON "order_items" ("product_id");

CREATE TABLE IF NOT EXISTS "agent_sessions" (
	"session_id" varchar(128) PRIMARY KEY NOT NULL,
	"user_id" text REFERENCES "public"."user"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "checkout_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"user_id" text REFERENCES "public"."user"("id") ON DELETE set null,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"buyer_mandate" jsonb,
	"razorpay_order_id" varchar(64),
	"payment_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "checkout_sessions_session_idx" ON "checkout_sessions" ("session_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"action" varchar(64) NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"explanation" text DEFAULT '' NOT NULL,
	"risk_level" "public"."risk_level" DEFAULT 'LOW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_session_idx" ON "audit_logs" ("session_id");
