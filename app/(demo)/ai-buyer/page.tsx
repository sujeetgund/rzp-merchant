"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, CheckCircle2, Play, RefreshCw, ArrowRight, ShieldCheck, AlertTriangle, ExternalLink, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { formatPaise } from "@/lib/format";

interface BuyerStep {
  step: number;
  title: string;
  action: string;
  status: "idle" | "running" | "success" | "error";
  requestPayload?: any;
  responsePayload?: any;
}

export default function AIBuyerDemoPage() {
  const [searchQuery, setSearchQuery] = useState("running shoes");
  const [maxAmountMandate, setMaxAmountMandate] = useState("4000");
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [steps, setSteps] = useState<BuyerStep[]>([
    {
      step: 1,
      title: "1. MCP Catalog Discovery",
      action: "search_products",
      status: "idle",
    },
    {
      step: 2,
      title: "2. MCP Cart Creation & Item Add",
      action: "create_cart & add_to_cart",
      status: "idle",
    },
    {
      step: 3,
      title: "3. ACP Checkout Session & Mandate Declaration",
      action: "create_checkout_session",
      status: "idle",
    },
    {
      step: 4,
      title: "4. Mandate Policy Verification & Order Completion",
      action: "complete_checkout_session",
      status: "idle",
    },
  ]);

  const updateStep = (index: number, update: Partial<BuyerStep>) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      return next;
    });
  };

  const runFullFlow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStepIndex(0);

    // Reset steps
    setSteps((prev) =>
      prev.map((s) => ({
        ...s,
        status: "idle",
        requestPayload: undefined,
        responsePayload: undefined,
      }))
    );

    try {
      // --- STEP 1: MCP CATALOG DISCOVERY ---
      updateStep(0, { status: "running" });
      const req1 = {
        jsonrpc: "2.0",
        id: "step-1",
        method: "tools/call",
        params: {
          name: "search_products",
          arguments: { query: searchQuery, maxPrice: Number(maxAmountMandate) },
        },
      };
      updateStep(0, { requestPayload: req1 });

      const res1 = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req1),
      }).then((r) => r.json());

      if (!res1.result?.data?.products || res1.result.data.products.length === 0) {
        updateStep(0, { status: "error", responsePayload: res1 });
        gooeyToast.error("No products found matching query.");
        setIsRunning(false);
        return;
      }

      updateStep(0, { status: "success", responsePayload: res1.result.data });
      const selectedProduct = res1.result.data.products[0];
      await new Promise((r) => setTimeout(r, 600));

      // --- STEP 2: CREATE CART & ADD ITEM ---
      updateStep(1, { status: "running" });
      setCurrentStepIndex(1);
      const req2Cart = {
        jsonrpc: "2.0",
        id: "step-2a",
        method: "tools/call",
        params: { name: "create_cart", arguments: {} },
      };
      const res2Cart = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req2Cart),
      }).then((r) => r.json());

      const cartId = res2Cart.result.data.cartId;

      const req2Add = {
        jsonrpc: "2.0",
        id: "step-2b",
        method: "tools/call",
        params: {
          name: "add_to_cart",
          arguments: { cartId, productId: selectedProduct.id, quantity: 1 },
        },
      };
      updateStep(1, { requestPayload: { createCart: req2Cart, addToCart: req2Add } });

      const res2Add = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req2Add),
      }).then((r) => r.json());

      updateStep(1, { status: "success", responsePayload: res2Add.result.data });
      await new Promise((r) => setTimeout(r, 600));

      // --- STEP 3: CREATE ACP CHECKOUT SESSION ---
      updateStep(2, { status: "running" });
      setCurrentStepIndex(2);
      const req3 = {
        cartId,
        maxAmount: Number(maxAmountMandate),
        allowedCategories: ["Footwear", "Apparel"],
      };
      updateStep(2, { requestPayload: req3 });

      const res3 = await fetch("/api/commerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req3),
      }).then((r) => r.json());

      updateStep(2, { status: "success", responsePayload: res3 });
      const csId = res3.checkoutSessionId;
      await new Promise((r) => setTimeout(r, 600));

      // --- STEP 4: COMPLETE ACP CHECKOUT ---
      updateStep(3, { status: "running" });
      setCurrentStepIndex(3);
      const req4 = { mode: "direct_capture" };
      updateStep(3, { requestPayload: req4 });

      const res4 = await fetch(`/api/commerce/checkout/${csId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req4),
      }).then((r) => r.json());

      if (res4.status === "PAUSED_MANDATE_EXCEEDED") {
        updateStep(3, { status: "error", responsePayload: res4 });
        gooeyToast.error("Mandate Exceeded: Cart total is higher than buyer max amount!");
      } else {
        updateStep(3, { status: "success", responsePayload: res4 });
        gooeyToast.success("Autonomous AI Buyer Transaction Complete!");
      }
    } catch (err: any) {
      gooeyToast.error(err?.message || "Autonomous flow error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            <span>Autonomous AI Buyer Agent Demo (V2)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Simulate an external AI Buyer (Claude Desktop, Procurement Bot) discovering products over <strong>MCP</strong> and transacting over <strong>ACP</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1 bg-primary/10 text-primary border-primary/30 font-medium">
            <Terminal className="size-3.5" />
            <span>MCP & ACP Enabled</span>
          </Badge>
          <Button variant="outline" size="sm" render={<Link href="/dashboard/agent-activity" />} className="h-8 text-xs gap-1">
            <span>Live Audit Console</span>
            <ExternalLink className="size-3" />
          </Button>
        </div>
      </div>

      {/* Control Panel Bar */}
      <Card className="border shadow-2xs">
        <CardHeader className="p-4 pb-3 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Agent Parameters & Spending Mandate</span>
            <Sparkles className="size-4 text-amber-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Search Query Keyword
            </label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. running shoes, loafers"
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Declared Spending Mandate (₹)
            </label>
            <Input
              type="number"
              value={maxAmountMandate}
              onChange={(e) => setMaxAmountMandate(e.target.value)}
              placeholder="e.g. 4000"
              className="h-9 text-xs font-mono"
            />
          </div>

          <Button
            onClick={runFullFlow}
            disabled={isRunning}
            className="h-9 text-xs font-bold gap-2 shadow-xs bg-primary text-primary-foreground"
          >
            {isRunning ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Executing Agent Protocol...</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Run Autonomous AI Buyer Session</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step by Step Timeline Cards */}
      <div className="space-y-4">
        {steps.map((s, idx) => {
          const isCurrent = isRunning && currentStepIndex === idx;

          return (
            <Card
              key={s.step}
              className={`border transition-all shadow-2xs ${
                s.status === "success"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : s.status === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : isCurrent
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : ""
              }`}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${
                      s.status === "success"
                        ? "bg-emerald-600 text-white"
                        : s.status === "error"
                        ? "bg-destructive text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status === "success" ? <CheckCircle2 className="size-4" /> : s.step}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">{s.title}</CardTitle>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{s.action}</p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 ${
                    s.status === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : s.status === "error"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : isCurrent
                      ? "bg-primary/10 text-primary border-primary/30"
                      : ""
                  }`}
                >
                  {isCurrent ? "RUNNING..." : s.status.toUpperCase()}
                </Badge>
              </CardHeader>

              {(s.requestPayload || s.responsePayload) && (
                <CardContent className="p-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {s.requestPayload && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                        Request Payload
                      </p>
                      <pre className="p-2.5 rounded-lg bg-black/90 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-40 border">
                        {JSON.stringify(s.requestPayload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {s.responsePayload && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                        Response Payload
                      </p>
                      <pre className="p-2.5 rounded-lg bg-black/90 text-blue-400 font-mono text-[10px] overflow-x-auto max-h-40 border">
                        {JSON.stringify(s.responsePayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
