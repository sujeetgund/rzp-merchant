"use client";

import { Sparkles } from "lucide-react";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";

export function FinFloatingWidget() {
  const { open } = useAIDrawer();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={open}
        className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-semibold border border-primary/20"
        title="Open AI Shopping Assistant"
      >
        <Sparkles className="size-4 text-amber-300" />
        <span>Ask AI</span>
      </button>
    </div>
  );
}
