import { HumanMessage } from "@langchain/core/messages";
import type { AIMessageChunk } from "@langchain/core/messages";
import { getSessionId } from "@/lib/session";
import { getCommerceGraph } from "@/lib/agent/graph";
import { isLlmConfigured } from "@/lib/llm/client";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

function sseEvent(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function normalizeToolOutput(output: unknown): unknown {
  if (output && typeof output === "object" && "content" in output) {
    const content = (output as { content: unknown }).content;
    if (typeof content === "string") {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return content;
  }
  return output;
}

function chunkText(chunk: AIMessageChunk): string {
  const { content } = chunk;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message?: string };
  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  if (!isLlmConfigured()) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured on the server." }), {
      status: 503,
    });
  }

  const sessionId = await getSessionId();

  await db
    .insert(agentSessions)
    .values({ sessionId })
    .onConflictDoUpdate({
      target: agentSessions.sessionId,
      set: { lastActiveAt: sql`now()` },
    });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const graph = await getCommerceGraph();
        const events = graph.streamEvents(
          { messages: [new HumanMessage(message)] },
          {
            version: "v2",
            configurable: { thread_id: sessionId, sessionId },
          }
        );

        for await (const event of events) {
          switch (event.event) {
            case "on_chat_model_stream": {
              const text = chunkText(event.data.chunk as AIMessageChunk);
              if (text) controller.enqueue(sseEvent({ type: "token", content: text }));
              break;
            }
            case "on_tool_start": {
              controller.enqueue(
                sseEvent({
                  type: "tool_start",
                  name: event.name,
                  input: event.data.input,
                })
              );
              break;
            }
            case "on_tool_end": {
              controller.enqueue(
                sseEvent({
                  type: "tool_end",
                  name: event.name,
                  output: normalizeToolOutput(event.data.output),
                })
              );
              break;
            }
            default:
              break;
          }
        }

        controller.enqueue(sseEvent({ type: "done" }));
      } catch (err) {
        controller.enqueue(sseEvent({ type: "error", message: (err as Error).message }));
      } finally {
        controller.close();
      }
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
