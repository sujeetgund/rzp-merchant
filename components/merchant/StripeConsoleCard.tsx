"use client";

import { useState } from "react";
import { Terminal, ShieldCheck, Code, Cpu, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StripeConsoleCard() {
  const [activeTab, setActiveTab] = useState<"mcp" | "hashes" | "webhooks">("mcp");

  const mcpPayload = {
    protocol: "Model Context Protocol (MCP v1)",
    agentRole: "Razorpay Revenue Assistant",
    toolCall: "create_checkout",
    sessionHash: "0x8f3a9b1c7d2e4f5a6b8c9d0e1f2a3b4c",
    cartSummary: {
      itemsCount: 2,
      totalInRupees: 3499.00,
      currency: "INR",
    },
    gatedPolicies: [
      { name: "Max Discount", cap: "15%", status: "PASSED" },
      { name: "Stock Reserved", status: "VERIFIED" },
    ],
  };

  const hashesPayload = {
    idempotencyKey: "idempotency_rzp_8839201a",
    cryptographicHash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    paymentRail: "Razorpay Standard Checkout v1",
    status: "CART_LOCKED_AND_SIGNED",
  };

  const webhooksPayload = {
    event: "payment.captured",
    razorpayPaymentId: "pay_Pz9K2xL8n3mQ4w",
    razorpayOrderId: "order_Pz9J1wK7m2nL3v",
    amountPaidInRupees: 3499.00,
    inventoryDeducted: true,
    timestamp: new Date().toISOString(),
  };

  const getPayload = () => {
    switch (activeTab) {
      case "mcp":
        return JSON.stringify(mcpPayload, null, 2);
      case "hashes":
        return JSON.stringify(hashesPayload, null, 2);
      case "webhooks":
        return JSON.stringify(webhooksPayload, null, 2);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-[#0c2340] text-slate-100 shadow-xl overflow-hidden font-mono text-xs">
      {/* IDE Console Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 bg-[#08172b] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500/80" />
            <span className="size-2.5 rounded-full bg-amber-500/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 font-bold text-slate-300 text-[11px]">Developer Console · MCP Telemetry</span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="size-3" />
            <span>HTTP 200 OK</span>
          </Badge>
        </div>
      </div>

      {/* Console Tab Switcher */}
      <div className="flex border-b border-slate-700/60 bg-[#0a1e36] px-2 pt-1 text-[11px]">
        <button
          onClick={() => setActiveTab("mcp")}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${
            activeTab === "mcp"
              ? "border-[#0052ff] text-white bg-[#0c2340]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Cpu className="size-3.5 text-blue-400" />
          <span>MCP Execution</span>
        </button>

        <button
          onClick={() => setActiveTab("hashes")}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${
            activeTab === "hashes"
              ? "border-[#0052ff] text-white bg-[#0c2340]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>Signed Hashes</span>
        </button>

        <button
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${
            activeTab === "webhooks"
              ? "border-[#0052ff] text-white bg-[#0c2340]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="size-3.5 text-purple-400" />
          <span>Razorpay Webhooks</span>
        </button>
      </div>

      {/* JSON Payload Viewport */}
      <div className="p-4 bg-[#08172b]/90 overflow-x-auto max-h-64">
        <pre className="text-emerald-400 leading-relaxed font-mono text-[11px] tabular-nums">
          {getPayload()}
        </pre>
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between border-t border-slate-700/60 bg-[#061221] px-4 py-2 text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <Code className="size-3 text-slate-400" />
          <span>OpenType tnum Enabled</span>
        </div>
        <span>Razorpay API v1 · Institutional Trust</span>
      </div>
    </div>
  );
}
