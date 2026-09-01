"use client";

import { Sparkles, ArrowRight, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";

export function StripeGradientHero() {
  const { open } = useAIDrawer();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 mb-8 bg-gradient-to-r from-[#fff7ed] via-[#f3e8ff] to-[#eff6ff] dark:from-[#111827] dark:via-[#1e1b4b] dark:to-[#0f172a] p-6 sm:p-10 shadow-sm">
      {/* Stripe Signature Atmospheric Mesh Accents */}
      <div className="absolute -top-24 -right-24 size-96 rounded-full bg-gradient-to-br from-[#533afd]/20 via-[#f96bee]/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-gradient-to-tr from-[#0052ff]/15 via-[#ea2261]/10 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Hero Copy & Actions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-white/80 dark:bg-card/80 text-primary border-primary/30 font-mono text-[11px] gap-1 px-2.5 py-1 rounded-full shadow-2xs">
              <Zap className="size-3 fill-current text-primary" />
              <span>Razorpay Agentic Commerce Protocol</span>
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] gap-1 px-2.5 py-1 rounded-full">
              <ShieldCheck className="size-3" />
              <span>Bounded Financial Gates Active</span>
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Autonomous Commerce Powered by AI & Razorpay
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Talk to our AI Revenue Assistant to find products, negotiate policy-approved bundles, get custom recommendations, and execute instant 1-click Razorpay checkouts.
          </p>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <Button
              onClick={open}
              size="lg"
              className="rounded-full bg-primary text-primary-foreground font-semibold px-6 shadow-md hover:shadow-lg transition-all gap-2 text-sm"
            >
              <Sparkles className="size-4 text-amber-300" />
              <span>Shop with AI Salesman</span>
              <ArrowRight className="size-4" />
            </Button>

            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ⚡ Instant 1-Click Payments
            </span>
          </div>
        </div>

        {/* Right Column: Intercom & Stripe Live Faux Console Preview */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border bg-card/90 dark:bg-card/95 backdrop-blur p-4 shadow-xl space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-xs text-foreground">Razorpay Revenue Assistant</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">LIVE SSE TRAIL</span>
            </div>

            {/* Simulated Chat & Tool execution card */}
            <div className="space-y-2">
              <div className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Buyer: &ldquo;Find running shoes under ₹4,000&rdquo;</p>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono font-medium text-primary">
                  <span>MCP tool: search_products</span>
                  <span className="tabular-nums text-[10px]">₹3,499.00 INR</span>
                </div>
                <div className="flex items-center justify-between bg-card p-2 rounded border text-[11px]">
                  <span className="font-semibold truncate">Trailblaze Running Shoes</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹3,499</span>
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t">
              <span>🔒 CART HASH: 0x8F3A...</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">APPROVED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
