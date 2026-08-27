"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/storefront/CartContext";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";
import { openRazorpayCheckout, verifyPaymentOnServer } from "@/lib/razorpay/checkoutClient";

interface MiniProduct {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  confidence?: number;
  basedOnProductName?: string;
}

interface ToolResult {
  name: string;
  output: unknown;
}

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  toolResults: ToolResult[];
  pending?: boolean;
}

const CART_TOOLS = new Set(["add_to_cart", "remove_from_cart", "get_cart"]);
const PRODUCT_LIST_TOOLS = new Set(["search_products", "get_recommendations"]);

function extractProducts(output: unknown): MiniProduct[] {
  if (!Array.isArray(output)) return [];
  return output.filter(
    (item): item is MiniProduct =>
      item && typeof item === "object" && "productId" in item && "name" in item && "price" in item
  );
}

function CheckoutOutput({ output }: { output: unknown }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [paying, setPaying] = useState(false);

  if (!output || typeof output !== "object") return null;
  if ("error" in output) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {String((output as { error: string }).error)}
      </p>
    );
  }
  const checkout = output as {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId?: string;
  };
  if (!checkout.razorpayOrderId) return null;

  return (
    <Button
      size="sm"
      disabled={paying}
      onClick={() => {
        if (!checkout.keyId) {
          toast.error("Razorpay key not configured on the client.");
          return;
        }
        setPaying(true);
        openRazorpayCheckout({
          keyId: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency,
          razorpayOrderId: checkout.razorpayOrderId,
          onSuccess: async (payload) => {
            const verified = await verifyPaymentOnServer(payload);
            if (!verified) {
              setPaying(false);
              toast.error("Payment could not be verified. Please contact support.");
              return;
            }
            await refresh();
            router.push(`/order/${checkout.orderId}`);
          },
          onFailure: (description) => {
            setPaying(false);
            toast.error(`Payment failed: ${description}`);
          },
          onDismiss: () => setPaying(false),
        });
      }}
    >
      {paying ? "Opening Razorpay..." : `Pay ${formatPaise(checkout.amount)}`}
    </Button>
  );
}

function ProductRow({ products }: { products: MiniProduct[] }) {
  const { addItem } = useCart();
  if (products.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {products.map((p) => (
        <div
          key={p.productId}
          className="w-36 shrink-0 rounded-lg border bg-background p-2 text-xs"
        >
          <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded bg-muted">
            {p.imageUrl && (
              <Image src={p.imageUrl} alt={p.name} fill sizes="144px" className="object-cover" />
            )}
          </div>
          <p className="line-clamp-2 font-medium">{p.name}</p>
          <p className="text-muted-foreground">{formatPaise(p.price)}</p>
          {typeof p.confidence === "number" && (
            <p className="mt-0.5 text-muted-foreground">
              {Math.round(p.confidence * 100)}% buy this with {p.basedOnProductName}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 h-7 w-full text-xs"
            onClick={async () => {
              await addItem(p.productId, 1);
              toast.success(`${p.name} added to cart`);
            }}
          >
            Add to cart
          </Button>
        </div>
      ))}
    </div>
  );
}

function TurnToolResults({ toolResults }: { toolResults: ToolResult[] }) {
  return (
    <div className="mt-2 space-y-2">
      {toolResults.map((result, i) => {
        if (PRODUCT_LIST_TOOLS.has(result.name)) {
          return <ProductRow key={i} products={extractProducts(result.output)} />;
        }
        if (result.name === "create_checkout") {
          return <CheckoutOutput key={i} output={result.output} />;
        }
        if (
          result.output &&
          typeof result.output === "object" &&
          "error" in result.output &&
          !CART_TOOLS.has(result.name)
        ) {
          return (
            <p key={i} className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {String((result.output as { error: string }).error)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

export function AIDrawer() {
  const { isOpen, setOpen } = useAIDrawer();
  const { refresh } = useCart();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  async function sendMessage() {
    const message = input.trim();
    if (!message || sending) return;

    setInput("");
    setSending(true);
    setTurns((prev) => [
      ...prev,
      { role: "user", text: message, toolResults: [] },
      { role: "assistant", text: "", toolResults: [], pending: true },
    ]);
    scrollToBottom();

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Something went wrong." }));
        throw new Error(body.error ?? "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let cartToolFired = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim());

          if (event.type === "token") {
            setTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, text: last.text + event.content, pending: false };
              return next;
            });
            scrollToBottom();
          } else if (event.type === "tool_end") {
            if (CART_TOOLS.has(event.name)) cartToolFired = true;
            setTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                pending: false,
                toolResults: [...last.toolResults, { name: event.name, output: event.output }],
              };
              return next;
            });
            scrollToBottom();
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (cartToolFired) await refresh();
    } catch (err) {
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          text: `Sorry, something went wrong: ${(err as Error).message}`,
          toolResults: [],
        };
        return next;
      });
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Shop with AI
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {turns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me things like &ldquo;Find me a birthday gift under ₹2,000&rdquo; or &ldquo;I need
                running shoes&rdquo;.
              </p>
            )}
            {turns.map((turn, i) => (
              <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    turn.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                      : "max-w-[95%] rounded-2xl bg-muted px-3.5 py-2 text-sm"
                  }
                >
                  {turn.pending ? (
                    <span className="text-muted-foreground">Thinking...</span>
                  ) : (
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  )}
                  {turn.toolResults.length > 0 && <TurnToolResults toolResults={turn.toolResults} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, deals, or checkout..."
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
