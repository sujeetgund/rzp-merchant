# rzp Merchant — V1: AI Salesman

An AI-native storefront: a traditional product catalog + cart, plus a conversational AI sales agent (LangGraph) that can search products, recommend cross-sells from real purchase history, manage the cart, and check the customer out via Razorpay — all in test mode.

See [implementation_plan.md](./implementation_plan.md) for the full multi-stage plan. This is the V1 slice: **AI Salesman**.

## Stack

Next.js 16 (App Router) · PostgreSQL + pgvector · Redis · Drizzle ORM · LangGraph.js · OpenAI-compatible LLM · Razorpay

## Setup

### 1. Start Postgres + Redis

```bash
pnpm db:up          # docker compose up -d (pgvector/pgvector:pg16 + redis)
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

- `OPENAI_API_KEY` — required for the AI agent (search, recommendations, chat) to work at all.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — test-mode keys from the [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys). Also set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the same key id.
- `RAZORPAY_WEBHOOK_SECRET` — only needed if you register a webhook (e.g. via a tunnel like ngrok) pointed at `/api/razorpay/webhook`. Payment confirmation itself does **not** depend on the webhook — it's verified client-side via the Checkout.js signature (`/api/razorpay/verify`), so checkout works fully on localhost without a public URL. The webhook is a secondary safety net matching production behavior.
- `MERCHANT_PASSWORD` / `MERCHANT_SESSION_SECRET` — gate for `/dashboard`, `/products`, `/orders` (single-merchant demo auth).

`DATABASE_URL` and `REDIS_URL` already point at the Docker Compose services by default.

### 3. Push the schema and seed data

```bash
pnpm db:push    # creates tables (incl. the pgvector extension + vector column)
pnpm db:seed    # 15 curated products + 500 synthetic paid orders for recommendations
```

Re-run `pnpm db:seed` any time to reset to a clean demo state (it truncates and reseeds).

### 4. Run

```bash
pnpm dev
```

- Storefront: `http://localhost:3000/`
- Merchant dashboard: `http://localhost:3000/login` (password from `MERCHANT_PASSWORD`)

## What's here (V1 scope)

- **Storefront**: product grid with search/category filters, product detail pages with variants, a cart (Redis-backed, keyed by an anonymous session cookie), and Razorpay Checkout.js payment.
- **AI Salesman**: a LangGraph agent (`lib/agent/graph.ts`) with tools for searching the catalog (pgvector semantic search + price/category filters), reading product details, generating cross-sell recommendations from real order history (support/confidence market-basket analysis, pure SQL), and managing the cart, culminating in `create_checkout`. Streamed token-by-token over SSE into a chat drawer, with inline product cards and a "Pay" button.
- **Merchant dashboard**: products CRUD, orders list, revenue/top-products analytics, and a live feed of every agent tool call with a plain-language explanation (`audit_logs`).
- **Payments**: Razorpay order creation, Checkout.js, client-side signature verification (works on localhost) plus a webhook handler (for production-style confirmation), and idempotent checkout (retrying with the same cart never double-charges).

Later stages (MCP server, ACP checkout API for external AI buyers, policy/HITL gating, campaign orchestrator) are described in `implementation_plan.md` but intentionally not built yet.

## Useful scripts

| Script | Purpose |
|---|---|
| `pnpm db:up` / `pnpm db:down` | Start/stop Postgres + Redis containers |
| `pnpm db:push` | Apply the Drizzle schema to Postgres |
| `pnpm db:seed` | Reset + seed catalog and synthetic order history |
| `pnpm db:studio` | Drizzle Studio (browse/edit data) |
| `pnpm dev` / `pnpm build` / `pnpm lint` | Standard Next.js scripts |
