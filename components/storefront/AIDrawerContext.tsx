"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface AIDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

const AIDrawerContext = createContext<AIDrawerContextValue | null>(null);

export function AIDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AIDrawerContext.Provider value={{ isOpen, open, close, setOpen: setIsOpen }}>
      {children}
    </AIDrawerContext.Provider>
  );
}

export function useAIDrawer(): AIDrawerContextValue {
  const ctx = useContext(AIDrawerContext);
  if (!ctx) throw new Error("useAIDrawer must be used within an AIDrawerProvider");
  return ctx;
}
