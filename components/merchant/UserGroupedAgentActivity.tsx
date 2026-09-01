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
  User,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SessionActivityGroup, AgentActivityItem } from "@/app/api/merchant/agent-activity/stream/route";

export interface UserSessionGroup {
  userId: string | null;
  userName: string;
  userEmail: string;
  sessions: SessionActivityGroup[];
  totalActions: number;
  lastActiveAt: string;
}

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
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Eye className="size-3" />
        <span>{open ? "Hide payload" : "View payload details"}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded bg-muted/60 p-2.5 text-[10px] font-mono leading-relaxed border">
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

function SessionCard({ session }: { session: SessionActivityGroup }) {
  const [expanded, setExpanded] = useState(true);
  const { time, relative } = formatTimestamp(session.lastActiveAt);
  const hasHighRisk = session.activities.some((a) => a.riskLevel === "HIGH");

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between border-b bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="size-3.5 text-primary" />
          <span className="font-mono text-xs font-semibold">
            Session: {session.sessionId.slice(0, 16)}...
          </span>
          {hasHighRisk && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[9px] uppercase">
              High Risk
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            ({session.activities.length} action{session.activities.length === 1 ? "" : "s"})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground">{relative}</span>
          {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="divide-y px-3.5 py-2">
          {session.activities.map((act) => {
            const actTime = formatTimestamp(act.createdAt);
            return (
              <div key={act.id} className="py-2 first:pt-1 last:pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">
                      {actTime.time}
                    </span>
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
                          <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
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

function UserGroupCard({ group }: { group: UserSessionGroup }) {
  const [expanded, setExpanded] = useState(true);
  const { relative } = formatTimestamp(group.lastActiveAt);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden mb-4">
      {/* User Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between border-b bg-muted/40 px-4 py-3 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
            {group.userName[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{group.userName}</span>
              <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                {group.userEmail}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {group.sessions.length} chat session{group.sessions.length === 1 ? "" : "s"} · {group.totalActions} total action{group.totalActions === 1 ? "" : "s"} · active {relative}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </div>
      </div>

      {/* User's Sessions */}
      {expanded && (
        <div className="p-4 space-y-3 bg-muted/10">
          {group.sessions.map((session) => (
            <SessionCard key={session.sessionId} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

export function UserGroupedAgentActivity({
  initialGroups = [],
}: {
  initialGroups?: SessionActivityGroup[];
}) {
  const [sessionGroups, setSessionGroups] = useState<SessionActivityGroup[]>(initialGroups);
  const [isLive, setIsLive] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH">("ALL");

  useEffect(() => {
    const es = new EventSource("/api/merchant/agent-activity/stream");

    es.onopen = () => setIsLive(true);
    es.addEventListener("snapshot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data)) setSessionGroups(data);
      } catch {}
    });

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data)) setSessionGroups(data);
      } catch {}
    });

    es.onerror = () => setIsLive(false);

    return () => es.close();
  }, []);

  // Filter sessions
  const filteredSessions = sessionGroups
    .map((g) => {
      const activities = g.activities.filter((a) => {
        if (riskFilter === "HIGH" && a.riskLevel !== "HIGH") return false;
        if (filterQuery.trim()) {
          const q = filterQuery.toLowerCase();
          return (
            a.action.toLowerCase().includes(q) ||
            a.explanation.toLowerCase().includes(q) ||
            g.sessionId.toLowerCase().includes(q) ||
            ((g as any).userName && (g as any).userName.toLowerCase().includes(q)) ||
            ((g as any).userEmail && (g as any).userEmail.toLowerCase().includes(q))
          );
        }
        return true;
      });
      return { ...g, activities };
    })
    .filter((g) => g.activities.length > 0);

  // Group by User
  const userGroupMap = new Map<string, UserSessionGroup>();

  for (const session of filteredSessions) {
    const userId = (session as any).userId || "anonymous";
    const userName = (session as any).userName || (userId === "anonymous" ? "Guest Sessions" : "Customer");
    const userEmail = (session as any).userEmail || (userId === "anonymous" ? "Anonymous Users" : "Registered User");

    let userGroup = userGroupMap.get(userId);
    if (!userGroup) {
      userGroup = {
        userId: userId === "anonymous" ? null : userId,
        userName,
        userEmail,
        sessions: [],
        totalActions: 0,
        lastActiveAt: session.lastActiveAt,
      };
      userGroupMap.set(userId, userGroup);
    }

    userGroup.sessions.push(session);
    userGroup.totalActions += session.activities.length;
    if (new Date(session.lastActiveAt) > new Date(userGroup.lastActiveAt)) {
      userGroup.lastActiveAt = session.lastActiveAt;
    }
  }

  const userGroups = Array.from(userGroupMap.values());

  return (
    <Card className="flex flex-col min-h-0 border shadow-xs">
      <CardHeader className="shrink-0 pb-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">User Chat Sessions & Agent Activity</CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Radio className="size-3 animate-pulse" />
              <span>{isLive ? "LIVE TELEMETRY" : "CONNECTING..."}</span>
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
              placeholder="Filter by customer name, email, session ID, or action..."
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

      <CardContent className="flex-1 overflow-y-auto p-4">
        {userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No agent activity matching filter.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Interact with the storefront AI Sales Assistant to generate telemetry.
            </p>
          </div>
        ) : (
          userGroups.map((group) => (
            <UserGroupCard key={group.userId || "anonymous"} group={group} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
