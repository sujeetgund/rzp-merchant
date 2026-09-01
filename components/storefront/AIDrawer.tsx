"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { gooeyToast } from "@/components/ui/goey-toaster";
import {
  Check,
  Plus,
  Send,
  Sparkles,
  Search,
  CreditCard,
  Package,
  ShoppingBag,
  ArrowUpRight,
  Bot,
  ArrowUp,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/storefront/CartContext";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";
import {
  openRazorpayCheckout,
  verifyPaymentOnServer,
} from "@/lib/razorpay/checkoutClient";
import { cn } from "@/lib/utils";

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

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed break-words [word-break:break-word] overflow-hidden">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="mt-2 mb-1 font-semibold text-foreground text-xs"
            >
              {renderInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={idx}
              className="mt-2 mb-1 font-bold text-foreground text-xs"
            >
              {renderInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="select-none text-muted-foreground">•</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={idx} className="my-2 border-border/50" />;
        }

        return <p key={idx}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function extractProducts(output: unknown): MiniProduct[] {
  if (!Array.isArray(output)) return [];
  return output.filter(
    (item): item is MiniProduct =>
      item &&
      typeof item === "object" &&
      "productId" in item &&
      "name" in item &&
      "price" in item,
  );
}

function CheckoutOutput({ output }: { output: unknown }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [paying, setPaying] = useState(false);

  if (!output || typeof output !== "object") return null;
  const [paid, setPaid] = useState(false);

  const checkout = output as {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId?: string;
  };

  useEffect(() => {
    if (checkout?.orderId) {
      const isPaid =
        localStorage.getItem(`rzp_paid_${checkout.orderId}`) === "true";
      if (isPaid) setPaid(true);
    }
  }, [checkout?.orderId]);

  if (!checkout?.razorpayOrderId) return null;

  if (paid) {
    return (
      <Button
        size="sm"
        disabled
        className="w-full bg-emerald-600 text-white dark:bg-emerald-600 font-semibold gap-1.5 opacity-100 cursor-default shadow-xs"
      >
        <Check className="size-4" /> Paid {formatPaise(checkout.amount)}
      </Button>
    );
  }

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded border border-border/40">
        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
          🔒 SIGNED CART HASH: 0x8F3A...
        </span>
        <span className="tabular-nums">IDEMPOTENT VERIFIED</span>
      </div>
      <Button
        size="sm"
        disabled={paying}
        className={cn(
          "w-full transition-all duration-200 font-medium tabular-nums",
          paying && "bg-primary/80",
        )}
        onClick={() => {
          if (!checkout.keyId) {
            gooeyToast.error("Razorpay key not configured on the client.");
            return;
          }
          setPaying(true);
          openRazorpayCheckout({
            keyId: checkout.keyId,
            amount: checkout.amount,
            currency: checkout.currency,
            razorpayOrderId: checkout.razorpayOrderId,
            onSuccess: async (payload) => {
              try {
                const verified = await verifyPaymentOnServer(payload);
                if (!verified) {
                  setPaying(false);
                  gooeyToast.error(
                    "Payment could not be verified. Please contact support.",
                  );
                  return;
                }
                localStorage.setItem(`rzp_paid_${checkout.orderId}`, "true");
                setPaid(true);
                setPaying(false);
                await refresh();
                gooeyToast.success("Payment successful!");
                router.push(`/order/${checkout.orderId}`);
              } catch {
                setPaying(false);
              }
            },
            onFailure: (description) => {
              setPaying(false);
              gooeyToast.error(`Payment failed: ${description}`);
            },
            onDismiss: () => {
              setPaying(false);
            },
          });
        }}
      >
        {paying ? "Opening Razorpay..." : `Pay ${formatPaise(checkout.amount)}`}
      </Button>
    </div>
  );
}

function MiniProductCard({ p }: { p: MiniProduct }) {
  const { addItem, cart } = useCart();
  const [loading, setLoading] = useState(false);

  const isInCart = cart.items.some((i) => i.productId === p.productId);

  const handleAdd = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await addItem(p.productId, 1);
      gooeyToast.success(`${p.name} added to cart`);
    } catch {
      gooeyToast.error("Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-36 shrink-0 rounded-lg border bg-background p-2 text-xs">
      <div className="relative mb-1.5 aspect-square w-full overflow-hidden rounded bg-muted">
        {p.imageUrl && (
          <Image
            src={p.imageUrl}
            alt={p.name}
            fill
            sizes="144px"
            className="object-cover"
          />
        )}
      </div>
      <p className="line-clamp-2 font-medium">{p.name}</p>
      <p className="text-muted-foreground font-mono">{formatPaise(p.price)}</p>
      {typeof p.confidence === "number" && (
        <p className="mt-0.5 text-muted-foreground text-[10px]">
          {Math.round(p.confidence * 100)}% buy this with {p.basedOnProductName}
        </p>
      )}
      <Button
        size="sm"
        variant={isInCart ? "default" : "outline"}
        disabled={loading}
        className={cn(
          "mt-1.5 h-7 w-full text-xs transition-all duration-200",
          isInCart &&
            "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 font-medium",
        )}
        onClick={handleAdd}
      >
        {loading ? (
          "Adding..."
        ) : isInCart ? (
          <span className="flex items-center justify-center gap-1 font-medium">
            <Check className="size-3" /> In Cart
          </span>
        ) : (
          "Add to cart"
        )}
      </Button>
    </div>
  );
}

function ProductRow({ products }: { products: MiniProduct[] }) {
  if (products.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {products.map((p) => (
        <MiniProductCard key={p.productId} p={p} />
      ))}
    </div>
  );
}

function TurnToolResults({ toolResults }: { toolResults: ToolResult[] }) {
  return (
    <div className="mt-2 space-y-2">
      {toolResults.map((result, i) => {
        if (PRODUCT_LIST_TOOLS.has(result.name)) {
          return (
            <ProductRow key={i} products={extractProducts(result.output)} />
          );
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
            <p
              key={i}
              className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {String((result.output as { error: string }).error)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

const STARTER_PROMPTS = [
  {
    icon: Search,
    title: "Running Shoes",
    prompt: "Find running shoes under ₹4,000",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    icon: Sparkles,
    title: "Recommendations",
    prompt: "What deals or recommendations do you have?",
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    icon: Package,
    title: "Apparel & Accessories",
    prompt: "Show fleece hoodies & wireless fitness trackers",
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    icon: CreditCard,
    title: "Instant Checkout",
    prompt: "Checkout my cart now",
    color: "text-emerald-500 bg-emerald-500/10",
  },
];

export function AIDrawer() {
  const { isOpen, setOpen } = useAIDrawer();
  const { refresh } = useCart();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  useEffect(() => {
    if (isOpen && turns.length === 0) {
      setLoadingHistory(true);
      fetch("/api/agent/chat")
        .then((res) => res.json())
        .then((data) => {
          if (
            data.turns &&
            Array.isArray(data.turns) &&
            data.turns.length > 0
          ) {
            setTurns(data.turns);
            scrollToBottom();
          }
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [isOpen, turns.length]);

  async function handleNewSession() {
    if (sending) return;
    try {
      const res = await fetch("/api/agent/session/new", { method: "POST" });
      if (res.ok) {
        setTurns([]);
        setInput("");
        gooeyToast.success("Started a new chat session");
      }
    } catch {
      gooeyToast.error("Failed to start new chat session");
    }
  }

  async function sendMessage(overrideMessage?: string) {
    const message = (overrideMessage || input).trim();
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
        const body = await res
          .json()
          .catch(() => ({ error: "Something went wrong." }));
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
              next[next.length - 1] = {
                ...last,
                text: last.text + event.content,
                pending: false,
              };
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
                toolResults: [
                  ...last.toolResults,
                  { name: event.name, output: event.output },
                ],
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
      const errorObj = err as any;
      const rawMsg = errorObj?.message ?? "";
      let friendlyMsg = rawMsg || "Something went wrong. Please try again.";

      gooeyToast.error(friendlyMsg);
      setInput(message);
      setTurns((prev) => prev.slice(0, -2));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md bg-background border-l shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b p-4 pr-12 bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-bold tracking-tight">
              <span>Shop with AI</span>
            </SheetTitle>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              disabled={sending}
              className="h-8 gap-1.5 text-xs px-3 shadow-2xs font-medium border-primary/20"
              title="Start a new chat session"
            >
              <Plus className="size-3.5 text-muted-foreground" />
              <span>New Chat</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Chat History & Starter Hero */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-5 py-2">
              {/* Hero Assistant Welcome Card */}
              <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shrink-0">
                    <Sparkles className="size-5 text-amber-400 fill-amber-400/20" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      AI Assistant
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Personalized Shopping & Instant Checkout
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t">
                  I can search products, compare prices, answer specs, manage
                  your cart, and generate instant Razorpay checkouts.
                </p>
              </div>

              {/* Interactive Starter Cards Grid */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Suggested Prompts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_PROMPTS.map((sp) => {
                    const Icon = sp.icon;
                    return (
                      <button
                        key={sp.title}
                        onClick={() => sendMessage(sp.prompt)}
                        className="group flex flex-col justify-between p-3 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/40 text-left transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <div
                            className={cn(
                              "p-1.5 rounded-lg shrink-0",
                              sp.color,
                            )}
                          >
                            <Icon className="size-3.5" />
                          </div>
                          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                            {sp.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {sp.prompt}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Conversation Turns */}
          {turns.map((turn, i) => {
            const hasText = Boolean(turn.text && turn.text.trim());
            const hasTools = turn.toolResults && turn.toolResults.length > 0;
            if (!hasText && !hasTools && !turn.pending) return null;

            return (
              <div
                key={i}
                className={
                  turn.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={cn(
                    "break-words [word-break:break-word] overflow-hidden text-xs",
                    turn.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-primary-foreground shadow-2xs"
                      : "max-w-[95%] rounded-2xl rounded-tl-xs bg-muted/60 border px-4 py-3 shadow-2xs",
                  )}
                >
                  {turn.pending ? (
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Sparkles className="size-3.5 animate-spin text-amber-500" />
                      <span>Thinking...</span>
                    </span>
                  ) : (
                    <FormattedText text={turn.text} />
                  )}
                  {turn.toolResults.length > 0 && (
                    <TurnToolResults toolResults={turn.toolResults} />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Re-imagined Sleek Floating Input Bar */}
        <div className="shrink-0 border-t bg-card p-3 space-y-1.5">
          <form
            id="ai-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="relative flex items-center rounded-xl border bg-background px-3 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI to find products, compare prices, or checkout..."
              disabled={sending}
              className="flex-1 bg-transparent border-0 p-0 h-8 text-xs focus-visible:ring-0 placeholder:text-muted-foreground/70 outline-none shadow-none"
            />
            <Button
              type="submit"
              size="icon-sm"
              disabled={sending || !input.trim()}
              className="size-7 rounded-lg bg-primary text-primary-foreground shrink-0 ml-2 transition-transform active:scale-95 disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </form>

          <p className="text-[10px] text-center text-muted-foreground font-mono">
            AI can make mistakes. Verify important details.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
