import { redis } from "@/lib/redis/client";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PolicyViolation {
  code: string;
  message: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  requiresHumanConfirmation: boolean;
  risk: RiskLevel;
  violations: PolicyViolation[];
  reason: string;
}

/** Declared by whoever deployed the AI buyer — carried in the checkout session, not merchant-configured. */
export interface BuyerMandate {
  maxAmount: number; // INR rupees
  allowedCategories?: string[];
}

export interface MerchantPolicyConfig {
  maxDiscountPercent: number;
  maxOrderAmountINR: number;
  requireApprovalAboveINR: number;
  allowedCategories: string[];
}

const DEFAULT_MERCHANT_POLICY: MerchantPolicyConfig = {
  maxDiscountPercent: 15,
  maxOrderAmountINR: 50000,
  requireApprovalAboveINR: 10000,
  allowedCategories: [],
};

export interface CheckoutLineItem {
  name: string;
  category?: string | null;
  quantity: number;
  priceInRupees: number;
}

/** Reads the single demo merchant's fraud/abuse + approval configuration. Falls back to sane defaults if unseeded. */
export async function getMerchantPolicyConfig(): Promise<MerchantPolicyConfig> {
  const [merchant] = await db.select().from(merchants).limit(1);
  if (!merchant?.policyConfig) return DEFAULT_MERCHANT_POLICY;
  return { ...DEFAULT_MERCHANT_POLICY, ...(merchant.policyConfig as Partial<MerchantPolicyConfig>) };
}

/**
 * Buyer-side check: does this cart violate the spending mandate the AI buyer
 * itself declared? This is not a merchant revenue limit — it's enforcing the
 * boundary the buyer's own deploying human set for their agent.
 */
function checkBuyerMandate(
  totalInRupees: number,
  items: CheckoutLineItem[],
  mandate: BuyerMandate | null | undefined
): PolicyViolation[] {
  if (!mandate) return [];
  const violations: PolicyViolation[] = [];

  if (totalInRupees > mandate.maxAmount) {
    violations.push({
      code: "MANDATE_AMOUNT_EXCEEDED",
      message: `Cart total (₹${totalInRupees}) exceeds the buyer's declared spending mandate (₹${mandate.maxAmount}).`,
    });
  }

  if (mandate.allowedCategories && mandate.allowedCategories.length > 0) {
    const disallowed = items.find(
      (item) =>
        item.category &&
        !mandate.allowedCategories!.includes("All Categories") &&
        !mandate.allowedCategories!.includes(item.category)
    );
    if (disallowed) {
      violations.push({
        code: "MANDATE_CATEGORY_VIOLATION",
        message: `"${disallowed.name}" is in category "${disallowed.category}", outside the buyer's allowed categories: [${mandate.allowedCategories.join(", ")}].`,
      });
    }
  }

  return violations;
}

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX_CHECKOUTS = 5;

/**
 * Merchant-side fraud/abuse check: caps how many checkout attempts a single
 * session can make in an hour. This protects against bulk/scripted abuse —
 * it is not a revenue limit, so it's set generously.
 */
async function checkRateLimit(sessionId: string): Promise<PolicyViolation[]> {
  const key = `ratelimit:checkout:${sessionId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (count > RATE_LIMIT_MAX_CHECKOUTS) {
    return [
      {
        code: "RATE_LIMIT_EXCEEDED",
        message: `More than ${RATE_LIMIT_MAX_CHECKOUTS} checkout attempts from this session in the last hour.`,
      },
    ];
  }
  return [];
}

function checkInventory(items: { name: string; quantity: number; availableInventory: number }[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const item of items) {
    if (item.quantity > item.availableInventory) {
      violations.push({
        code: "INSUFFICIENT_INVENTORY",
        message: `Only ${item.availableInventory} unit(s) of "${item.name}" available (requested ${item.quantity}).`,
      });
    }
  }
  return violations;
}

export interface EvaluateCheckoutPolicyInput {
  sessionId: string;
  totalInRupees: number;
  items: CheckoutLineItem[];
  inventoryCheck?: { name: string; quantity: number; availableInventory: number }[];
  mandate?: BuyerMandate | null;
  /** Skip the per-session rate limit — used for idempotent retries of an already-accepted checkout. */
  skipRateLimit?: boolean;
}

/**
 * Single entry point combining buyer-mandate checks (declared by the AI
 * buyer) and merchant-side fraud/abuse checks (inventory, rate limiting,
 * high-value approval threshold). Mirrors the PolicyCheck contract in
 * implementation_plan.md section 3.1.
 */
export async function evaluateCheckoutPolicy(
  input: EvaluateCheckoutPolicyInput
): Promise<PolicyCheckResult> {
  const merchantPolicy = await getMerchantPolicyConfig();
  const violations: PolicyViolation[] = [];

  violations.push(...checkBuyerMandate(input.totalInRupees, input.items, input.mandate));

  if (input.inventoryCheck) {
    violations.push(...checkInventory(input.inventoryCheck));
  }

  if (!input.skipRateLimit) {
    violations.push(...(await checkRateLimit(input.sessionId)));
  }

  if (input.totalInRupees > merchantPolicy.maxOrderAmountINR) {
    violations.push({
      code: "MERCHANT_MAX_ORDER_EXCEEDED",
      message: `Order total (₹${input.totalInRupees}) exceeds this merchant's configured maximum order amount (₹${merchantPolicy.maxOrderAmountINR}).`,
    });
  }

  const hasViolation = violations.length > 0;
  const requiresApproval = input.totalInRupees > merchantPolicy.requireApprovalAboveINR;
  const risk: RiskLevel = hasViolation ? "HIGH" : requiresApproval ? "MEDIUM" : "LOW";

  const reason = violations.length > 0
    ? violations.map((v) => v.message).join(" ")
    : requiresApproval
      ? `Order total ₹${input.totalInRupees} exceeds the merchant's ₹${merchantPolicy.requireApprovalAboveINR} auto-approval threshold — human confirmation required.`
      : "All policy checks passed.";

  return {
    allowed: !hasViolation,
    requiresHumanConfirmation: hasViolation || requiresApproval,
    risk,
    violations,
    reason,
  };
}
