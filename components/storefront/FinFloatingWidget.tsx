"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";
import { useSession } from "@/lib/auth/auth-client";
import { AuthModal } from "@/components/auth/AuthModal";

export function FinFloatingWidget() {
  const { open } = useAIDrawer();
  const { data: session } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleClick = () => {
    if (!session?.user) {
      setAuthModalOpen(true);
    } else {
      open();
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleClick}
          className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 text-xs font-semibold border border-primary/20"
          title="Open AI Shopping Assistant"
        >
          <Sparkles className="size-4 text-amber-300" />
          <span>Ask AI</span>
        </button>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title="Sign In to Shop with AI"
        description="Please sign in or create an account to talk with our AI Sales Assistant."
        onSuccess={() => open()}
      />
    </>
  );
}
