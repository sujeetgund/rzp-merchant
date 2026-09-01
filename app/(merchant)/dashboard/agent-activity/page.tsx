import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, agentSessions, user } from "@/lib/db/schema";
import { UserGroupedAgentActivity } from "@/components/merchant/UserGroupedAgentActivity";
import type { SessionActivityGroup } from "@/app/api/merchant/agent-activity/stream/route";
import { Sparkles, Bot, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getInitialSessionGroups(): Promise<SessionActivityGroup[]> {
  const logs = await db
    .select({
      id: auditLogs.id,
      sessionId: auditLogs.sessionId,
      action: auditLogs.action,
      input: auditLogs.input,
      output: auditLogs.output,
      explanation: auditLogs.explanation,
      riskLevel: auditLogs.riskLevel,
      createdAt: auditLogs.createdAt,
      sessionCreatedAt: agentSessions.createdAt,
      sessionLastActiveAt: agentSessions.lastActiveAt,
      userId: agentSessions.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(agentSessions, eq(auditLogs.sessionId, agentSessions.sessionId))
    .leftJoin(user, eq(agentSessions.userId, user.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(150);

  const groupMap = new Map<string, SessionActivityGroup>();

  for (const log of logs) {
    let group = groupMap.get(log.sessionId);
    if (!group) {
      group = {
        sessionId: log.sessionId,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        lastActiveAt: (log.sessionLastActiveAt ?? log.createdAt).toISOString(),
        createdAt: (log.sessionCreatedAt ?? log.createdAt).toISOString(),
        activities: [],
      };
      groupMap.set(log.sessionId, group);
    }
    group.activities.push({
      id: log.id,
      sessionId: log.sessionId,
      action: log.action,
      input: log.input,
      output: log.output,
      explanation: log.explanation,
      riskLevel: log.riskLevel,
      createdAt: log.createdAt.toISOString(),
    });
  }

  return Array.from(groupMap.values());
}

export default async function AgentActivityPage() {
  const initialGroups = await getInitialSessionGroups();

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] min-h-0 overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <span>Agent Activity & Telemetry</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time chat session activity grouped by user with live tool execution telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
            <ShieldCheck className="size-3.5" />
            <span>Autonomous Execution Guarded</span>
          </Badge>
        </div>
      </div>

      {/* Main Content: User-Grouped Agent Telemetry Stream */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <UserGroupedAgentActivity initialGroups={initialGroups} />
      </div>
    </div>
  );
}
