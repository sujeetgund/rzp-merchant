"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Radio,
  ShieldAlert,
  Search,
  ShoppingCart,
  Sparkles,
  CreditCard,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SessionActivityGroup, AgentActivityItem } from "@/app/api/merchant/agent-activity/stream/route";

function formatTimestamp(isoString: string): { time: string; relative: string } {
  try {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    let relative = `${diffSec}s ago`;
    if (diffSec >= 60 && diffSec < 3600) {
      relative = `${Math.floor(diffSec / 60)}m ago`;
    } else if (diffSec >= 3600) {
      relative = `${Math.floor(diffSec / 3600)}h ago`;
    }
    return { time, relative };
  } catch {
    return { time: "--:--:--", relative: "" };
  }
}

function ActionIcon({ action }: { action: string }) {
  switch (action.toUpperCase()) {
    case "SEARCH_PRODUCTS":
      return <Search className="size-3.5 text-blue-500" />;
    case "RECOMMEND":
      return <Sparkles className="size-3.5 text-purple-500" />;
    case "ADD_TO_CART":
    case "REMOVE_FROM_CART":
    case "GET_CART":
      return <ShoppingCart className="size-3.5 text-amber-500" />;
    case "CREATE_CHECKOUT":
      return <CreditCard className="size-3.5 text-emerald-500" />;
    default:
      return <Bot className="size-3.5 text-muted-foreground" />;
  }
}

function PayloadViewer({ input, output }: { input: unknown; output: unknown }) {
  const [open, setOpen] = useState(false);

  if (!input && !output) return null;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Eye className="size-3" />
        <span>{open ? "Hide payload" : "View payload details"}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded bg-muted/60 p-2 text-[10px] font-mono leading-relaxed">
          {Boolean(input) && (
            <div>
              <span className="font-semibold text-muted-foreground">Input: </span>
              <span>{JSON.stringify(input)}</span>
            </div>
          )}
          {Boolean(output) && (
            <div>
              <span className="font-semibold text-muted-foreground">Output: </span>
              <span>{JSON.stringify(output)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionGroupCard({ group }: { group: SessionActivityGroup }) {
  const [expanded, setExpanded] = useState(true);
  const { time, relative } = formatTimestamp(group.lastActiveAt);

  const hasHighRisk = group.activities.some((a) => a.riskLevel === "HIGH");

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-2xs transition-all">
      {/* Session Group Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between border-b bg-muted/20 px-4 py-3 hover:bg-muted/40"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold tracking-tight">
                {group.sessionId.length > 20
                  ? `${group.sessionId.slice(0, 18)}...`
                  : group.sessionId}
              </span>
              {hasHighRisk && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[9px] uppercase">
                  Risk
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {group.activities.length} action(s) · active {relative}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-[11px] font-mono text-muted-foreground">
            {time}
          </div>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Activity Timeline Items */}
      {expanded && (
        <div className="divide-y p-3">
          {group.activities.map((act) => {
            const actTime = formatTimestamp(act.createdAt);
            return (
              <div key={act.id} className="relative py-2.5 first:pt-1 last:pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {/* Timestamp left-most column */}
                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {actTime.time}
                    </span>

                    {/* Action Icon + Content */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <ActionIcon action={act.action} />
                        <span className="font-mono text-xs font-semibold">{act.action}</span>
                        <Badge
                          variant={
                            act.riskLevel === "HIGH"
                              ? "destructive"
                              : act.riskLevel === "MEDIUM"
                                ? "secondary"
                                : "outline"
                          }
                          className="h-4 px-1.5 text-[9px]"
                        >
                          {act.riskLevel}
                        </Badge>

                        {act.action === "CREATE_CHECKOUT" && (
                          <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                            🔒 SIGNED 0x8F3A
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {act.explanation}
                      </p>

                      <PayloadViewer input={act.input} output={act.output} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AgentActivityTrail({
  initialGroups = [],
}: {
  initialGroups?: SessionActivityGroup[];
}) {
  const [groups, setGroups] = useState<SessionActivityGroup[]>(initialGroups);
  const [isLive, setIsLive] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH">("ALL");

  useEffect(() => {
    // SSE Live Trail Setup
    const es = new EventSource("/api/merchant/agent-activity/stream");

    es.onopen = () => setIsLive(true);

    es.addEventListener("snapshot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data)) setGroups(data);
      } catch {}
    });

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data)) setGroups(data);
      } catch {}
    });

    es.onerror = () => {
      setIsLive(false);
    };

    return () => {
      es.close();
    };
  }, []);

  const filteredGroups = groups
    .map((g) => {
      const activities = g.activities.filter((a) => {
        if (riskFilter === "HIGH" && a.riskLevel !== "HIGH") return false;
        if (filterQuery.trim()) {
          const q = filterQuery.toLowerCase();
          return (
            a.action.toLowerCase().includes(q) ||
            a.explanation.toLowerCase().includes(q) ||
            g.sessionId.toLowerCase().includes(q)
          );
        }
        return true;
      });
      return { ...g, activities };
    })
    .filter((g) => g.activities.length > 0);

  return (
    <Card className="h-full flex flex-col min-h-0 overflow-hidden border shadow-xs">
      <CardHeader className="shrink-0 pb-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">Recent Agent Activity</CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Radio className="size-3 animate-pulse" />
              <span>{isLive ? "LIVE SSE TRAIL" : "CONNECTING..."}</span>
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search sessions or actions..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
          <Button
            size="sm"
            variant={riskFilter === "HIGH" ? "destructive" : "outline"}
            className="h-8 text-xs gap-1"
            onClick={() => setRiskFilter(riskFilter === "HIGH" ? "ALL" : "HIGH")}
          >
            <ShieldAlert className="size-3" />
            <span>High Risk Only</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No agent activity matching filter.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Interact with the storefront AI Salesman to see live timestamped activity.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <SessionGroupCard key={group.sessionId} group={group} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
