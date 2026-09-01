# rzp Merchant — AI-Native E-Commerce Platform

An AI-native merchant platform powered by **Razorpay**, **Better Auth**, **Next.js 16 (Turbopack)**, **Drizzle ORM**, **PostgreSQL (pgvector)**, **Redis**, and **Gemini 2.5**.

Human customers can browse the storefront, search with live autocomplete, chat with an AI Sales Assistant, and checkout securely via Razorpay. External AI agents can discover products over **MCP (Model Context Protocol)** and complete orders over **ACP (Agentic Commerce Protocol)**.

---

## 🔐 3-Tier Agent Access & Security Protocol

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC DISCOVERY (Tier 1)                       │
│    Tools: search_products, get_product, check_inventory                │
│    Auth: PUBLIC (No API key required)                                  │
│    Behavior: Any AI agent (Claude, Cursor, ChatGPT) can freely crawl  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      ANONYMOUS CART & SESSION (Tier 2)                 │
│    Tools: create_cart, add_to_cart, get_recommendations               │
│    Auth: Anonymous Redis Session ID (cart_...)                         │
│    Behavior: Agent builds cart state without needing user auth yet.    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MANDATE & TRANSACTION EXECUTION (Tier 3)            │
│    Tools: create_checkout_session, complete_checkout_session           │
│    Auth: Spending Mandate Check + Optional Merchant/Buyer Key          │
│    Behavior: Validates total <= maxAmount. If total > maxAmount,      │
│              pauses transaction and issues human payment link.          │
└────────────────────────────────────────────────────────────────────────┘
```

### 🗝️ Key & Privilege Roles

1. **Public Agent Access (No Key)**:
   - **Capabilities**: Unauthenticated catalog search, product discovery, live stock check, and market basket recommendations via `/api/mcp`.
2. **Buyer Delegation Token (`X-Buyer-Agent-Token`)**:
   - **Generation**: Customers generate their Buyer Delegation Key inside **Account Settings → AI Agent Keys** in the customer UI.
   - **Capabilities**: Authorizes external AI agents (Claude Desktop, Cursor, AI Bots) to purchase on behalf of the customer, bounded strictly by the customer's declared spending limit mandate (e.g. `maxAmount: ₹5,000`).
   - **Policy Guardrail**: If an agent attempts an order exceeding the declared mandate, the system automatically pauses the order and generates a human confirmation link (`rzp.io/...`).
3. **Merchant API Key (`Authorization: Bearer mcp_live_...`)**:
   - **Generation**: Issued by merchant administrators from the Merchant Control Center (`merchant_api_keys` table).
   - **Capabilities**: Grants partner agents and B2B procurement bots elevated privileges (wholesale prices, high API rate limits, automated test capture).

---

## Key Features (V1 + V2 Completed)

### 🛒 Consumer Storefront
- **Modern E-Commerce UI**: Clean, responsive storefront built with TailwindCSS v4 and Geist typography.
- **Product Autocomplete Search**: `@shadcn-space/autocomplete-05` search bar with real-time animated popover suggestions, category badges, product image thumbnails, and keyboard navigation (`↑`/`↓`/`Enter`).
- **Category Navigation**: Interactive category pills with instant URL state management.
- **Razorpay Checkout**: Seamless Razorpay Checkout.js modal integration with client/server signature verification and signed cart hash fingerprinting.

### 🔐 Better Auth Authentication
- **Multi-Factor & Passwordless**: Credential (email/password) authentication + **WebAuthn Passkeys** (`@better-auth/passkey`).
- **Resend Email Verification**: Email verification flow powered by `resend.com` (`RESEND_API_KEY`).
- **User Account Settings & AI Agent Keys**: Tabbed user profile modal:
  - `Profile`: View email verification status & resend verification.
  - `Security & Passkeys`: List biometric passkeys, add passkeys, delete passkeys, update password.
  - `AI Agent Keys`: Generate **Buyer Delegation Tokens** with declared spending mandates (`maxAmount`).
- **Session-Gated Features**: Shop with AI drawer and Razorpay checkout are strictly gated to authenticated users.

### 🤖 AI Sales Assistant ("Shop with AI")
- **Stateful Conversational Agent**: Built with LangGraph streaming via Server-Sent Events (SSE).
- **Multi-Turn Tools**:
  - `search_products`: Semantic vector search (`pgvector`) + keyword & price filtering.
  - `get_recommendations`: Market-basket association analysis (support/confidence mathematical co-purchase mining).
  - `add_to_cart` / `remove_from_cart` / `get_cart`: Cart state manipulation in Redis.
  - `create_checkout`: Idempotent Razorpay order generation.
- **Re-imagined UI**: Hero welcome card, 4 interactive starter prompt cards, and floating pill input bar.

### 🌐 MCP Server & ACP Protocols (V2)
- **Official `@modelcontextprotocol/sdk`**: Serves JSON-RPC 2.0 tools over `/api/mcp`.
- **ACP Checkout Sessions**: `/api/commerce/checkout` API for creating checkout sessions carrying buyer spending mandates.
- **Interactive AI Buyer Demo**: `/ai-buyer` step-by-step console visualizing autonomous AI buyer agent flows.

### 📊 Merchant Control Center
- **Key Financial Metrics**: Total Revenue (INR ₹), Paid Orders count, Average Order Value (AOV), and AI Operations count.
- **Recent Orders Table**: Latest 6 completed customer checkouts with Razorpay order IDs, customer details, and status badges.
- **Top Products Table**: Best-performing catalog items by sales revenue and units sold.
- **Developer Console**: Integrated Stripe-style developer console with live event stream.
- **User-Grouped Agent Activity**: Dedicated `/dashboard/agent-activity` page grouping live AI chat sessions by registered customer (User avatar, email, session count, total actions, and SSE telemetry).

---

## Tech Stack

```
Next.js 16 (App Router, Turbopack, Server Actions)
TailwindCSS v4 + Geist Font + Lucide Icons + Framer Motion
Better Auth (Email/Password, WebAuthn Passkeys, Resend Email Verification)
PostgreSQL + pgvector (Catalog, Orders, Accounts, Passkeys, Audit Logs)
Redis (ioredis — Cart sessions, Agent state)
Drizzle ORM (Type-safe SQL queries & schema migrations)
LangGraph.js + Gemini 2.5 / OpenAI (AI Agent Orchestration)
@modelcontextprotocol/sdk (Official MCP TypeScript SDK)
@shadcn-space/autocomplete-05 (Live search autocomplete)
Razorpay Node SDK + Checkout.js (Payment processing & verification)
```

---

## Setup & Quick Start

### 1. Start Postgres + Redis Containers

```bash
pnpm db:up          # Starts pgvector/pgvector:pg16 and redis via Docker Compose
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rzp_merchant
REDIS_URL=redis://localhost:6379

BETTER_AUTH_SECRET=your_better_auth_secret_32_chars_long
BETTER_AUTH_URL=http://localhost:3000

RESEND_API_KEY=re_123456789
EMAIL_FROM="rzp Merchant <onboarding@resend.dev>"

RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

LLM_API_KEY=your_gemini_or_openai_api_key
LLM_MODEL=gemini-2.5-flash
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

### 3. Push Schema & Seed Synthetic Orders

```bash
pnpm db:push    # Applies Drizzle schema (user, session, account, passkey, products, orders, audit_logs)
pnpm db:seed    # Seeds 15 curated catalog items + 500 synthetic historical orders for co-purchase recommendations
```

### 4. Run Development Server

```bash
pnpm dev
```

- **Storefront**: [http://localhost:3000](http://localhost:3000)
- **AI Buyer Demo (V2)**: [http://localhost:3000/ai-buyer](http://localhost:3000/ai-buyer)
- **Merchant Control Center**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **User-Grouped Agent Telemetry**: [http://localhost:3000/dashboard/agent-activity](http://localhost:3000/dashboard/agent-activity)

---

## Useful Commands

| Script | Purpose |
|---|---|
| `pnpm db:up` / `pnpm db:down` | Start or stop Postgres + Redis Docker containers |
| `pnpm db:push` | Synchronize Drizzle schema with PostgreSQL |
| `pnpm db:seed` | Truncate and re-seed catalog & synthetic historical orders |
| `pnpm db:studio` | Open Drizzle Studio database manager UI |
| `pnpm dev` | Run Next.js Turbopack development server |
| `pnpm build` | Compile production build with TypeScript checking |
