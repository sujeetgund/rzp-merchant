import { db } from "@/lib/db";
import { auditLogs, agentSessions, user } from "@/lib/db/schema";
import { desc, eq, gte } from "drizzle-orm";

export const runtime = "nodejs";

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export interface AgentActivityItem {
  id: string;
  sessionId: string;
  action: string;
  input: unknown;
  output: unknown;
  explanation: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}

export interface SessionActivityGroup {
  sessionId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  lastActiveAt: string;
  createdAt: string;
  activities: AgentActivityItem[];
}

async function fetchSessionGroups(): Promise<SessionActivityGroup[]> {
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

export async function GET() {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let isAlive = true;

      // 1. Send initial snapshot
      try {
        const initialGroups = await fetchSessionGroups();
        controller.enqueue(sseEvent("snapshot", initialGroups));
      } catch (err) {
        console.error("SSE initial error:", err);
      }

      // 2. Poll DB for live changes every 3s and stream diffs
      let lastCheckTime = new Date();

      const interval = setInterval(async () => {
        if (!isAlive) return;
        try {
          const newLogs = await db
            .select()
            .from(auditLogs)
            .where(gte(auditLogs.createdAt, lastCheckTime))
            .orderBy(desc(auditLogs.createdAt));

          lastCheckTime = new Date();

          if (newLogs.length > 0) {
            const updatedGroups = await fetchSessionGroups();
            controller.enqueue(sseEvent("update", updatedGroups));
          } else {
            controller.enqueue(sseEvent("ping", { time: new Date().toISOString() }));
          }
        } catch (err) {
          // Ignore transient errors
        }
      }, 3000);

      return () => {
        isAlive = false;
        clearInterval(interval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
