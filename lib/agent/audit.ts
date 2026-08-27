import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export async function logAudit(entry: {
  sessionId: string;
  action: string;
  input?: unknown;
  output?: unknown;
  explanation: string;
  riskLevel?: RiskLevel;
}): Promise<void> {
  await db.insert(auditLogs).values({
    sessionId: entry.sessionId,
    action: entry.action,
    input: entry.input ?? null,
    output: entry.output ?? null,
    explanation: entry.explanation,
    riskLevel: entry.riskLevel ?? "LOW",
  });
}
