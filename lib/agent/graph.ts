import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { getChatModel } from "@/lib/llm/client";
import { commerceTools } from "@/lib/agent/tools";
import { getCheckpointer } from "@/lib/agent/checkpointer";

const SYSTEM_PROMPT = `You are the AI sales assistant for this online store, chatting directly with a shopper.

Your job is to help the shopper find what they want and turn the conversation into a completed sale — while being honest and low-pressure.

Guidelines:
- Use search_products to find items matching what the shopper describes. Don't guess product details — always look them up.
- When the shopper has something in their cart, call get_recommendations with the cart's product ids to find genuine cross-sell opportunities (based on real historical co-purchase data), and mention the strongest one naturally, with the actual reason (e.g. "X% of customers who bought this also got Y"). Don't force an upsell if there's no good match.
- Use add_to_cart / remove_from_cart when the shopper asks to add or remove something, and use get_cart to check what's currently in the cart.
- Only call create_checkout after the shopper has explicitly confirmed they want to pay for what's in the cart. Summarize the cart and total first.
- All prices are in Indian Rupees (INR). Amounts from tools are in paise (1/100 rupee) unless noted — convert to rupees when speaking to the shopper.
- If a tool returns an error (e.g. out of stock, empty cart), explain it plainly and suggest an alternative.
- Keep responses concise, clean, and conversational. Use simple bullet points and bold text for formatting. Do not generate raw markdown ASCII tables (e.g. | col | col |); present lists and cart items cleanly using bullet points instead.`;

async function buildGraph() {
  const checkpointer = await getCheckpointer();
  const model = getChatModel().bindTools(commerceTools);
  const toolNode = new ToolNode(commerceTools);

  async function agentNode(state: typeof MessagesAnnotation.State, config: RunnableConfig) {
    const sanitizedMessages = state.messages.map((msg) => {
      const isTool =
        (typeof ToolMessage.isInstance === "function" && ToolMessage.isInstance(msg)) ||
        (msg as any)._getType?.() === "tool" ||
        (msg as any).type === "tool" ||
        (msg as any).role === "tool";

      if (isTool) {
        const rawContent = msg.content;
        let stringContent: string;
        if (typeof rawContent === "string") {
          stringContent = rawContent;
        } else if (Array.isArray(rawContent)) {
          stringContent = rawContent
            .map((item) =>
              typeof item === "string"
                ? item
                : (item as { text?: string }).text ?? JSON.stringify(item)
            )
            .filter(Boolean)
            .join("\n");
        } else {
          stringContent = JSON.stringify(rawContent);
        }

        if (!stringContent || stringContent.trim() === "" || stringContent.trim() === "[]") {
          stringContent = "No results returned.";
        }

        return new ToolMessage({
          content: stringContent,
          tool_call_id:
            (msg as ToolMessage).tool_call_id ||
            (msg as any).tool_call_id ||
            "call_unknown",
          name: (msg as ToolMessage).name || (msg as any).name,
          id: msg.id,
        });
      }
      return msg;
    });

    const response = await model.invoke(
      [new SystemMessage(SYSTEM_PROMPT), ...sanitizedMessages],
      config
    );
    return { messages: [response] };
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, { tools: "tools", [END]: END })
    .addEdge("tools", "agent")
    .compile({ checkpointer });
}

type Graph = Awaited<ReturnType<typeof buildGraph>>;

declare global {
  var __rzpGraph: Promise<Graph> | undefined;
}

export function getCommerceGraph(): Promise<Graph> {
  if (!globalThis.__rzpGraph) {
    globalThis.__rzpGraph = buildGraph();
  }
  return globalThis.__rzpGraph;
}
