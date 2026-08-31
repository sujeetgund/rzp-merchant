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
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String(part.text)
          : "",
      )
      .join("");
  }
  return "";
}

export async function GET() {
  const sessionId = await getSessionId();
  try {
    const graph = await getCommerceGraph();
    const state = await graph.getState({
      configurable: { thread_id: sessionId, sessionId },
    });

    const rawMessages = (state.values as { messages?: any[] })?.messages || [];
    const pairs: Array<{
      userText: string;
      assistantText: string;
      toolResults: Array<{ name: string; output: unknown }>;
    }> = [];

    for (const msg of rawMessages) {
      const type =
        (msg as any)._getType?.() ||
        (msg as any).type ||
        (msg as any).role ||
        (msg.constructor?.name === "HumanMessage" ? "human" : "") ||
        (msg.constructor?.name === "AIMessage" ? "ai" : "") ||
        (msg.constructor?.name === "ToolMessage" ? "tool" : "");

      if (type === "human" || type === "user") {
        const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        pairs.push({
          userText: text,
          assistantText: "",
          toolResults: [],
        });
      } else if (type === "ai" || type === "assistant") {
        const textContent = typeof msg.content === "string" ? msg.content : chunkText(msg);
        if (pairs.length === 0 || (!pairs[pairs.length - 1].userText && pairs[pairs.length - 1].assistantText)) {
          if (textContent && textContent.trim()) {
            pairs.push({
              userText: "",
              assistantText: textContent,
              toolResults: [],
            });
          }
        } else {
          const lastPair = pairs[pairs.length - 1];
          if (textContent && textContent.trim()) {
            lastPair.assistantText = lastPair.assistantText
              ? `${lastPair.assistantText}\n\n${textContent}`
              : textContent;
          }
        }
      } else if (type === "tool") {
        if (pairs.length === 0) {
          pairs.push({ userText: "", assistantText: "", toolResults: [] });
        }
        const lastPair = pairs[pairs.length - 1];
        lastPair.toolResults.push({
          name: (msg as any).name || "tool",
          output: normalizeToolOutput(msg.content),
        });
      }
    }

    // Flatten pairs into generic turns array
    const turns: Array<{
      role: "user" | "assistant";
      text: string;
      toolResults: Array<{ name: string; output: unknown }>;
    }> = [];

    for (const p of pairs) {
      const hasUserText = Boolean(p.userText && p.userText.trim());
      const hasAssistantContent = Boolean(p.assistantText.trim()) || p.toolResults.length > 0;

      // Discard orphaned user prompts that failed mid-execution before producing any response
      if (hasUserText && !hasAssistantContent) {
        continue;
      }

      if (hasUserText) {
        turns.push({
          role: "user",
          text: p.userText,
          toolResults: [],
        });
      }

      if (hasAssistantContent) {
        turns.push({
          role: "assistant",
          text: p.assistantText,
          toolResults: p.toolResults,
        });
      }
    }

    return Response.json({ turns });
  } catch (err) {
    return Response.json({ turns: [] });
  }
}

export async function POST(request: Request) {
  const { message } = (await request.json()) as { message?: string };
  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
    });
  }

  if (!isLlmConfigured()) {
    return new Response(
      JSON.stringify({ error: "LLM_API_KEY is not configured on the server." }),
      {
        status: 503,
      },
    );
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
          },
        );

        for await (const event of events) {
          switch (event.event) {
            case "on_chat_model_stream": {
              const text = chunkText(event.data.chunk as AIMessageChunk);
              if (text)
                controller.enqueue(sseEvent({ type: "token", content: text }));
              break;
            }
            case "on_tool_start": {
              controller.enqueue(
                sseEvent({
                  type: "tool_start",
                  name: event.name,
                  input: event.data.input,
                }),
              );
              break;
            }
            case "on_tool_end": {
              controller.enqueue(
                sseEvent({
                  type: "tool_end",
                  name: event.name,
                  output: normalizeToolOutput(event.data.output),
                }),
              );
              break;
            }
            default:
              break;
          }
        }

        controller.enqueue(sseEvent({ type: "done" }));
      } catch (err) {
        const errorObj = err as any;
        const statusCode =
          errorObj?.status ??
          errorObj?.statusCode ??
          errorObj?.response?.status ??
          errorObj?.status_code;
        const rawMsg = errorObj?.message ?? "";

        let friendlyMsg = rawMsg;
        if (
          statusCode === 429 ||
          rawMsg.includes("429") ||
          rawMsg.toLowerCase().includes("rate limit")
        ) {
          friendlyMsg =
            "The AI assistant is receiving a high volume of requests right now. Please wait a few seconds and try again.";
        }
        controller.enqueue(sseEvent({ type: "error", message: friendlyMsg }));
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
