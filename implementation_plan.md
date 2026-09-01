# rzp Merchant — Implementation Plan

### _A merchant that humans and AI agents can discover, shop, and transact with_

---

## Background

**Track:** AI Growth & Agentic Commerce  
**Goal:** Build an AI-native merchant platform powered by Razorpay that (a) sells more to human customers via an AI sales agent and (b) makes the merchant fully transactable by external AI buyers.

The platform evolves across four stages: V1 (AI Salesman) → V2 (AI-Buyable Merchant) → V3 (Safe Agentic Payments) → V4 (AI Growth Agent).

---

## Answering Your Open Questions

### Q1: Can we do everything in Next.js, or do we need FastAPI/Python for AI?

**Answer: 100% Next.js. No Python needed.**

LangGraph ships as **`@langchain/langgraph`** (TypeScript-native). The full AI stack runs server-side in Next.js API routes and Server Actions:

| Concern             | Solution (pure JS/TS)                              |
| ------------------- | -------------------------------------------------- |
| Agent orchestration | `@langchain/langgraph` (StateGraph, nodes, edges)  |
| LLM calls           | `@langchain/openai` or `@langchain/anthropic`      |
| Tool calling        | LangGraph tool nodes, function calling             |
| Streaming responses | LangGraph `streamEvents` → SSE → React             |
| Human-in-the-loop   | LangGraph interrupt mechanism + API route approval |
| MCP server          | `@modelcontextprotocol/sdk` (official TS SDK)      |
| Vector search       | pgvector extension on Postgres                     |
| Session/cache       | `ioredis` for Redis                                |

The only scenario where Python adds value is if you want to use advanced ML libraries (e.g., scikit-learn for real association mining). For our use case (support/confidence math is pure arithmetic), **there is no reason to introduce Python**.

---

### Q2: Are all Razorpay APIs available / is the project feasible?

**Answer: Yes, fully feasible. All required APIs are in test mode.**

> [!IMPORTANT]
> Razorpay **does not have a native product catalog API** (like Shopify's). We own the catalog in our Postgres DB, and we use Razorpay strictly for the **payment/order layer**. This is correct architecture — catalog is ours, payments are Razorpay's.

| API                                       | Availability            | Purpose                     |
| ----------------------------------------- | ----------------------- | --------------------------- |
| `POST /v1/orders`                         | ✅ Test mode            | Create order before payment |
| `GET /v1/orders/{id}`                     | ✅ Test mode            | Fetch order details         |
| `GET /v1/orders/{id}/payments`            | ✅ Test mode            | Payment status on order     |
| `POST /v1/payments/{id}/capture`          | ✅ Test mode            | Capture authorized payment  |
| `GET /v1/payments/{id}`                   | ✅ Test mode            | Fetch payment details       |
| `POST /v1/refunds`                        | ✅ Test mode            | Refund a payment            |
| Webhooks (`order.paid`, `payment.failed`) | ✅ Test mode            | Async payment events        |
| Razorpay Checkout JS                      | ✅ Test mode            | In-browser payment widget   |
| Test cards (success/fail simulation)      | ✅ Provided by Razorpay | Demo failure handling       |

**What we build ourselves (not from Razorpay):**

- Product catalog, inventory, cart — owned in Postgres
- Agent session state — Redis + Postgres
- Policy engine, audit trail — our code
- MCP server, ACP checkout session — our code

---

## Tech Stack

```
Next.js 16 (App Router, API Routes, Server Actions)
PostgreSQL + pgvector (catalog, orders, audit log, vector embeddings)
Redis (cart sessions, agent state cache, rate limiting)
Drizzle ORM (type-safe SQL, migrations)
LangGraph.js (@langchain/langgraph) — agent orchestration
OpenAI-compatible LLM — model + base URL configurable via .env
@modelcontextprotocol/sdk — MCP server (HTTP+SSE transport)
Razorpay Node.js SDK + Checkout.js — payments
```

> [!NOTE]
> **Next.js version:** Next.js 16.3.3 is installed. shadcn/ui is installed.

> [!NOTE]
> **LLM:** Any OpenAI-compatible provider works. Switch model and base URL via `LLM_MODEL` and `LLM_BASE_URL` in `.env`. Default: GPT-4o via OpenAI. Swap to local Ollama, Anthropic proxy, or any OpenAI-compatible endpoint without code changes.

---

## Full Architecture (V4)

```
                          USER
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
         HUMAN BUYER                AI BUYER
              │                         │
       ┌──────┴──────┐          ┌───────┴────────┐
       │             │          │                │
       ▼             ▼          ▼                ▼
  Traditional   Conversational  MCP          ACP Checkout
   Storefront     AI Drawer   Server          Interface
       │             │          │                │
       │             └────┬─────┘                │
       └──────────────────┼──────────────────────┘
                          ▼
                  LangGraph Commerce Agent
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
   Recommendation      Policy         Campaign
      Engine           Engine        Orchestrator
     (support/           │                │
     confidence)   ┌─────┴─────┐         │
                   │           │         │
                Amount    Product        │
                limits    category       │
                           filter        │
                               │         │
                               └────┬────┘
                                    ▼
                             Razorpay APIs
                             (Test Mode)
                                    │
                                    ▼
                                 ORDER
                                    │
                                    ▼
                              AUDIT LOG
                         (Agent Activity Console)
```

---

## Database Schema (Drizzle ORM)

```typescript
// Core tables
merchants; // merchant account + settings
products; // catalog (name, price, inventory, variants, category)
product_embeddings; // pgvector for semantic search
order_items; // line items (for support/confidence computation)
orders; // our internal orders + Razorpay order_id
agent_sessions; // LangGraph thread state
checkout_sessions; // ACP-style checkout session objects (carry buyer's declared mandate)
audit_logs; // every agent action with explanation + risk level
campaigns; // V4 campaign definitions
campaign_results; // V4 campaign performance metrics
```

---

## Project Structure

```
rzp-merchant/
├── app/
│   ├── (merchant)/          # Merchant dashboard (auth-gated)
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── analytics/
│   │   └── campaigns/       # V4
│   ├── (store)/             # Customer storefront
│   │   ├── page.tsx         # Product listing
│   │   ├── products/[id]/   # Product detail
│   │   └── cart/
│   ├── api/
│   │   ├── agent/chat/      # LangGraph SSE stream
│   │   ├── agent/approve/   # HITL approval endpoint
│   │   ├── commerce/        # ACP-style checkout API (V2)
│   │   ├── razorpay/
│   │   │   ├── order/       # Create Razorpay order
│   │   │   └── webhook/     # Payment webhook handler
│   │   └── mcp/             # MCP server endpoint (V2)
│   └── layout.tsx
├── lib/
│   ├── agent/
│   │   ├── graph.ts         # LangGraph StateGraph definition
│   │   ├── tools.ts         # Commerce tools (search, cart, checkout)
│   │   ├── policy.ts        # Policy engine
│   │   └── recommendations.ts # Support/confidence engine
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema
│   │   └── index.ts
│   ├── mcp/
│   │   └── server.ts        # MCP server definition (V2)
│   └── razorpay/
│       └── client.ts        # Razorpay SDK wrapper
├── components/
│   ├── storefront/
│   │   ├── AIDrawer.tsx     # Conversational AI panel
│   │   ├── CartSidebar.tsx
│   │   └── ProductCard.tsx
│   ├── merchant/
│   │   ├── AuditConsole.tsx # Agent Activity Console
│   │   └── PolicyConfig.tsx # V3 policy settings
│   └── shared/
├── drizzle/
│   └── migrations/
└── package.json
```

---

---

# V1 — AI Salesman

**Goal:** Help a merchant sell more to human customers via a conversational AI agent.

**V1 Success Metric:** Can the AI turn a conversation into a completed test-mode Razorpay order?

---

## V1 Components

### 1.1 Merchant Dashboard

**Pages:** Products CRUD, Inventory management, Orders list, Basic analytics (revenue, top products)

**Implementation:** Next.js App Router with server components. Drizzle ORM queries. No external dependencies beyond standard Next.js patterns.

#### [NEW] `app/(merchant)/dashboard/page.tsx`

Dashboard overview: total revenue, order count, top products.

#### [NEW] `app/(merchant)/products/page.tsx`

Product list with add/edit/delete. Form for: name, description, price, inventory, category, variants (JSON), image URL.

#### [NEW] `app/(merchant)/orders/page.tsx`

Order list with status, Razorpay order ID, payment status.

---

### 1.2 Customer Storefront

Traditional ecommerce UI. Product grid, product detail page, cart sidebar.

#### [NEW] `app/(store)/page.tsx`

Product listing with search/filter. Products fetched from our DB.

#### [NEW] `app/(store)/products/[id]/page.tsx`

Product detail with "Add to Cart" and "Shop with AI" CTA.

#### [NEW] `components/storefront/CartSidebar.tsx`

Slide-out cart. Cart state in Redis (keyed by session ID cookie).

---

### 1.3 AI Sales Agent (LangGraph)

The core innovation of V1. A stateful LangGraph agent with commerce tools.

#### Agent Tools

```typescript
// lib/agent/tools.ts

search_products({ query, maxPrice?, category? })
  → semantic search (pgvector) + keyword filter

get_product({ productId })
  → full product details + current inventory

get_recommendations({ productIds[] })
  → support/confidence pairs for the given products

get_cart({ sessionId })
  → current cart contents

add_to_cart({ sessionId, productId, quantity, variantId? })
  → adds item, returns updated cart

remove_from_cart({ sessionId, productId })
  → removes item

create_checkout({ sessionId })
  → creates Razorpay order, returns payment amount + order_id
  → emits audit log entry
```

#### LangGraph Graph Definition

```typescript
// lib/agent/graph.ts

StateGraph with MessagesAnnotation + custom state:
  - sessionId: string
  - cartContents: CartItem[]
  - pendingCheckout?: { razorpayOrderId, amount }
  - auditLog: AuditEntry[]

Nodes:
  - agent_node: LLM with tools bound
  - tool_node:  ToolNode executing commerce tools

Edges:
  - agent → tools (if tool call)
  - agent → END  (if final response)
  - tools → agent

Checkpointer: PostgresSaver (persists conversation per sessionId)
```

#### Recommendation Engine

```typescript
// lib/agent/recommendations.ts

// For a given set of productIds in a cart:
// 1. Query order_items to find co-occurring products
// 2. Compute support = orders(A∩B) / total_orders
// 3. Compute confidence = orders(A∩B) / orders(A)
// 4. Return top-N recommendations sorted by confidence

function getRecommendations(productIds: string[]): Recommendation[];
```

This is pure SQL arithmetic — no ML library needed.

#### AI Drawer UI

```typescript
// components/storefront/AIDrawer.tsx
// Slide-in panel with:
//   - Chat interface (messages list)
//   - Streaming agent responses via SSE
//   - Product cards rendered inline in chat
//   - "Add to Cart" buttons in chat
//   - "Proceed to Checkout" button
```

#### Streaming API Route

```typescript
// app/api/agent/chat/route.ts
// POST: { sessionId, message }
// Returns: SSE stream from LangGraph streamEvents
// Streams: token-by-token text + tool call events for UI
```

---

### 1.4 Razorpay Payment (V1)

Human completes checkout via Razorpay Checkout.js modal.

```typescript
// app/api/razorpay/order/route.ts
// POST: { sessionId }
// 1. Validate cart is non-empty
// 2. Call Razorpay POST /v1/orders with amount, currency=INR
// 3. Return { orderId, amount, key }
// Client: Open Razorpay Checkout modal

// app/api/razorpay/webhook/route.ts
// POST from Razorpay
// Events: payment.captured → mark order paid, clear cart
//         payment.failed   → log failure, keep cart
// Verify HMAC-SHA256 signature before processing
```

**Seed Data:** Seed 50 products across 5 categories with synthetic order history (500 historical orders) to make recommendations work from day 1.

---

---

# V2 — AI-Buyable Merchant

**Goal:** Make the merchant transactable by an external AI buyer. No browser UI required.

**Key distinction:** This adds two new interfaces — **MCP** and an **ACP-style Checkout API** — so external AI agents can discover and purchase from the merchant programmatically.

---

## V2 Components

### 2.1 MCP Server

Exposes merchant capabilities as MCP tools so any MCP-compatible AI agent (Claude Desktop, custom agent, etc.) can interact with the merchant.

```typescript
// lib/mcp/server.ts
// Uses @modelcontextprotocol/sdk

Tools exposed:
  search_products        // Discovery
  get_product            // Discovery
  check_inventory        // Discovery
  get_recommendations    // Discovery
  create_cart            // Commerce
  add_to_cart            // Commerce
  get_cart               // Commerce
  create_checkout        // Checkout (returns checkout session ID)
  get_checkout           // Checkout status
```

```typescript
// app/api/mcp/route.ts
// Serves MCP over HTTP/SSE transport
// External agents connect here
```

> [!IMPORTANT]
> MCP's `create_checkout` tool **does not complete payment**. It creates a checkout session in `DRAFT` state. Payment is only triggered when the AI buyer explicitly calls `POST /api/commerce/checkout/:id/complete`. The buyer's declared spending mandate (carried in the session) is validated at that point.

---

### 2.2 ACP-Style Checkout Session API

An HTTP REST API aligned with the Agentic Commerce Protocol's checkout session concept. This is the "seller-side" interface for AI buyers.

```
POST   /api/commerce/checkout               → Create checkout session (buyer declares mandate)
GET    /api/commerce/checkout/:id           → Get session status
PATCH  /api/commerce/checkout/:id           → Update (add/remove items)
POST   /api/commerce/checkout/:id/complete  → Complete (triggers payment)
DELETE /api/commerce/checkout/:id           → Cancel session
```

**Checkout Session object:**

```json
{
  "id": "cs_abc123",
  "status": "DRAFT",
  "items": [{ "productId": "...", "quantity": 1, "price": 2499 }],
  "total": 2499,
  "currency": "INR",
  "buyerMandate": {
    "maxAmount": 3000,
    "allowedCategories": ["shoes"],
    "declaredBy": "ai-buyer-agent"
  },
  "razorpayOrderId": null,
  "paymentLink": null,
  "createdAt": "...",
  "expiresAt": "..."
}
```

**Checkout session states:**

```
DRAFT → VALIDATED → PAYMENT_INITIATED → PAID / FAILED / CANCELLED
```

**AI Buyer Payment — Two approaches:**

```
Approach A — Payment Link (realistic, recommended for demo Act 3)
  AI buyer completes checkout session
          ↓
  Our backend creates Razorpay Payment Link (POST /v1/payment_links)
          ↓
  Link returned in checkout session response
          ↓
  AI buyer surfaces link: "Human confirmation needed: rzp.io/xxxx"
          ↓
  Human clicks → pays → webhook confirms

Approach B — Programmatic test payment (fully automated demo)
  AI buyer calls POST /api/commerce/checkout/:id/complete
          ↓
  Backend creates Razorpay order + simulates capture via test API
          ↓
  Payment confirmed without any browser/human step
  (Test mode only — not production-realistic)
```

> [!NOTE]
> **Demo strategy:** Use Approach B (programmatic) for Act 2 (show full AI automation). Use Approach A (payment link) for Act 3 (show human-gated trust model). Both demonstrate different real-world agentic commerce patterns.

---

### 2.3 External AI Buyer Demo

A demo page that simulates an external AI buyer using the MCP + ACP interfaces:

```typescript
// app/(demo)/ai-buyer/page.tsx
// Step-by-step visualization:
// 1. "Find running shoes under ₹3,000" → search_products via MCP
// 2. Selects product → create_cart, add_to_cart via MCP
// 3. Creates checkout session with declared mandate (maxAmount: ₹3,000)
// 4. Mandate validated against cart total
// 5. Completes checkout → payment link OR direct test capture
```

This is the demo's Act 2 — the most impressive part for judges.

---

---

# V3 — Safe Agentic Payments

**Goal:** Every money action must be explainable, bounded, and gated. The AI does the shopping — the human controls the spending authority.

---

## V3 Components

### 3.1 Policy Engine

**Ownership is clear:**

- **Buyer's mandate** → set by whoever deployed the AI buyer. Declares what the AI is allowed to spend. Carried inside the checkout session.
- **Merchant's checks** → fraud/abuse protection. Not revenue limiting — merchants want sales. Guards against bulk abuse, inventory manipulation, unauthorized discounts.

```typescript
// lib/agent/policy.ts

interface PolicyCheck {
  allowed: boolean;
  reason: string;
  requiresHumanConfirmation: boolean; // buyer must confirm (gating)
  risk: "LOW" | "MEDIUM" | "HIGH";
  violations: string[];
}

function checkPolicy(checkout: CheckoutSession): PolicyCheck;

// Buyer-side checks (from checkout session's declared mandate):
// 1. Cart total ≤ buyerMandate.maxAmount
// 2. All products within buyerMandate.allowedCategories

// Merchant-side checks (fraud/abuse protection):
// 3. Inventory available (no overselling)
// 4. Rate limit: not more than N orders per session per hour
// 5. Idempotency: no duplicate order for same cart fingerprint
// 6. No unauthorized discount codes applied
```

**Buyer mandate (declared by the AI buyer in the checkout session):**

```typescript
interface BuyerMandate {
  maxAmount: number; // "My user said: spend up to ₹3,000"
  allowedCategories?: string[]; // "My user said: only shoes"
  requireHumanPaymentConfirmation: boolean; // always true → payment link flow
}
```

> [!NOTE]
> The mandate is **not** set by the merchant. It is declared by the AI buyer and reflects the authority granted by that buyer's end user. The merchant verifies it isn't violated — they don't configure it.

---

### 3.2 Human-in-the-Loop Approval

When `policyResult.requiresApproval = true`, the checkout session pauses and sends a notification (in demo: visible in Agent Activity Console, in production: webhook/push notification to merchant).

```typescript
// Merchant dashboard shows pending approvals
// app/(merchant)/approvals/page.tsx

// Approval API:
// POST /api/agent/approve
// { checkoutSessionId, approved: boolean, approvedBy: string }
```

LangGraph's `interrupt()` mechanism handles this natively — the graph pauses at the policy node waiting for external input.

---

### 3.3 Explainability Layer

Every agent decision is stored in `audit_logs` with a structured explanation:

```typescript
interface AuditEntry {
  timestamp: Date;
  sessionId: string;
  action: string; // "SEARCH_PRODUCTS" | "RECOMMEND" | "POLICY_CHECK" | ...
  input: object; // What the agent received
  output: object; // What the agent decided
  explanation: string; // Human-readable why
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiresApproval: boolean;
  policyViolations: string[];
}
```

**Example explanation for a recommendation:**

```
Action: RECOMMEND_PRODUCT
Product: Performance Socks (₹399)
Reason:
  • Customer added Running Shoes (₹2,499)
  • 40% of Running Shoe orders include Performance Socks (confidence = 0.40)
  • Price ₹399 is within remaining budget
  • Inventory: 127 units available
Risk: LOW
Approval required: No
```

---

### 3.4 Agent Activity Console

Real-time timeline visible on the merchant dashboard and in the demo.

```typescript
// components/merchant/AuditConsole.tsx
// Live feed via SSE (or polling)
// Shows timestamped entries:
//   Intent → Search → Filter → Recommend → Upsell → Approve → Pay → Result

// Entries are color-coded by risk level
// Policy violations shown in red
// Payment events highlighted
```

---

### 3.5 Graceful Failure Handling

**Payment failure demo (Act 4):**

```typescript
// Use Razorpay test card that forces failure: 4000000000000002
// When webhook receives payment.failed:
// 1. Mark checkout session as FAILED
// 2. Do NOT create a duplicate order (idempotency key on Razorpay order)
// 3. Log audit entry: PAYMENT_FAILED
// 4. Agent response: "Payment wasn't completed. No charge was made and
//    no duplicate order was created. Would you like to retry?"
// 5. Checkout session returned to AUTHORIZED state for retry
```

**Idempotency guarantee:**

```typescript
// Each checkout session has a fingerprint = hash(sessionId + cartFingerprint)
// Before calling Razorpay POST /orders, check:
//   SELECT * FROM orders WHERE idempotency_key = fingerprint
// If exists and payment is pending, return existing order
// This prevents double-charging on retry
```

---

---

# V4 — AI Growth Agent

**Goal:** Move from selling to one customer to growing the merchant's entire business.

The merchant says: _"Increase weekend revenue by 15% while keeping discounts below 10%."_

---

## V4 Components

### 4.1 Analytics Engine

Aggregated queries from `orders` + `order_items` tables:

```typescript
// lib/analytics/engine.ts

getRevenueByPeriod(period: 'day'|'week'|'month')
getTopProducts(limit: number)
getConversionRate(period)
getUpsellPerformance()         // cross-sell pairs + revenue attributed
getCustomerSegments()          // new vs returning, AOV bands
getCampaignPerformance(campaignId)
```

---

### 4.2 Campaign Orchestrator (LangGraph)

A separate LangGraph graph for campaign planning — this is a multi-step reasoning agent, not a chat agent.

```typescript
// lib/agent/campaign-graph.ts

Nodes:
  1. analyze_data    → reads analytics, finds opportunity
  2. propose_campaign → LLM proposes target segment, product, discount, budget
  3. human_review    → HITL: merchant approves/rejects/edits
  4. launch          → creates campaign record, enables discount rules
  5. monitor         → periodic check on campaign performance
  6. optimize        → if underperforming, adjust discount/target
```

**Campaign input (merchant says):**

> "Increase weekend revenue by 15% while keeping discounts below 10%."

**Agent output (before merchant approval):**

```json
{
  "target": "Returning customers (AOV > ₹1,500)",
  "products": ["Running Shoes", "Sports Kit"],
  "discount": "8%",
  "upsell": "Performance Socks",
  "budget": "₹5,000",
  "duration": "This weekend",
  "expectedImpact": "+12–18% revenue",
  "explanation": "These 3 products drove 42% of last weekend's revenue.
                  Returning customers have 2.3x conversion rate.
                  8% discount keeps margin positive."
}
```

Merchant clicks Approve → campaign launches.

---

### 4.3 Campaign Dashboard

```typescript
// app/(merchant)/campaigns/page.tsx
// List of campaigns with status: PROPOSED | ACTIVE | COMPLETED
// Performance metrics per campaign: revenue, orders, conversion, ROI
// Campaign creation: text input → Agent proposes → Merchant approves
```

---

---

## Verification Plan

### V1 Verification

- [ ] Merchant can add products and see them in storefront
- [ ] AI agent can answer "Find me shoes under ₹3,000" with relevant products
- [ ] Agent suggests cross-sell via support/confidence
- [ ] `create_checkout` creates a real Razorpay order in test mode
- [ ] Razorpay Checkout modal opens and payment succeeds
- [ ] `payment.captured` webhook marks order as paid
- [ ] Audit log entry created for every tool call

### V2 Verification

- [ ] MCP server discoverable and tools callable from an external MCP client
- [ ] ACP checkout session API: create → get → complete lifecycle works
- [ ] Demo AI buyer script completes a purchase end-to-end
- [ ] Checkout session status transitions correctly

### V3 Verification

- [ ] Policy engine blocks cart total exceeding buyer's declared mandate
- [ ] Merchant's rate-limit check prevents inventory abuse
- [ ] Payment link generated for human-gated AI buyer flow
- [ ] Programmatic test payment works for fully-automated demo flow
- [ ] Payment failure (test card `4000000000000002`) handled gracefully
- [ ] No duplicate order created on retry (idempotency key)
- [ ] Audit console shows full timeline with explanations

### V4 Verification

- [ ] Campaign orchestrator proposes a valid campaign from natural language input
- [ ] Merchant can approve/reject proposed campaign
- [ ] Campaign performance metrics update after simulated orders

---

## Prioritization

```
V1: ████████████████████  MUST BE EXCELLENT (foundation + demo)
V2: ██████████████████    MUST BE EXCELLENT (key differentiator)
V3: ████████████████      MUST WORK WELL (trust/safety layer)
V4: ██████                THIN PROTOTYPE IS FINE (wow vision)
```

---

## Demo Story (6 Acts)

| Act | Scenario                                                                                                               | Demonstrates                             |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Human: "Birthday gift under ₹2,000" → AI recommends → upsells socks → Checkout.js payment succeeds                     | V1: AI Salesman + upsell                 |
| 2   | AI Buyer via MCP: discovers catalog, creates checkout session (mandate: ₹3,000), completes programmatic test payment   | V2: AI-buyable merchant, full automation |
| 3   | AI Buyer tries purchase of ₹5,000 item → Mandate violated → session fails → payment link issued for human confirmation | V3: Bounded + gated, human-in-the-loop   |
| 4   | Payment fails → "No charge made, no duplicate order. Retry?"                                                           | V3: Graceful failure + idempotency       |
| 5   | Open Agent Activity Console → full timestamped timeline with structured explanations                                   | V3: Explainable + auditable              |
| 6   | Merchant: "Grow weekend revenue by 15%" → Campaign proposed by AI                                                      | V4: AI Growth vision                     |

---

## Resolved Decisions

| Decision              | Resolution                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **LLM Provider**      | OpenAI-compatible. `LLM_MODEL` + `LLM_BASE_URL` in `.env`. No code changes to switch providers.                          |
| **MCP Transport**     | HTTP+SSE. Accessible to remote clients and compatible with Claude Desktop.                                               |
| **AP2 Protocol**      | Not implemented. Out of scope — buyer-side concern. MCP + ACP is the complete protocol story.                            |
| **AI Buyer payment**  | Two modes: Approach A (Payment Link, realistic) + Approach B (programmatic test capture, demo automation).               |
| **Policy ownership**  | Merchant side = fraud/abuse protection. Buyer side = spending mandate declared in checkout session.                      |
| **Seed data**         | 15 curated products with known co-purchase patterns + 500 synthetic historical orders for reliable demo recommendations. |
| **Campaign delivery** | Out of scope. Demo shows proposal + merchant approval flow only.                                                         |
