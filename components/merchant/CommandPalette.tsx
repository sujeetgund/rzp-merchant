"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Activity,
  Plus,
  LogOut,
  Command,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/app/(merchant)/actions";

interface CommandItem {
  id: string;
  label: string;
  category: "Navigation" | "Actions" | "System";
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  perform: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commands: CommandItem[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      category: "Navigation",
      icon: LayoutDashboard,
      shortcut: "G D",
      perform: () => router.push("/dashboard"),
    },
    {
      id: "nav-products",
      label: "Manage Products & Inventory",
      category: "Navigation",
      icon: Package,
      shortcut: "G P",
      perform: () => router.push("/products"),
    },
    {
      id: "nav-orders",
      label: "View All Orders",
      category: "Navigation",
      icon: ShoppingCart,
      shortcut: "G O",
      perform: () => router.push("/orders"),
    },
    {
      id: "nav-store",
      label: "Open Storefront in New Tab",
      category: "Navigation",
      icon: Store,
      shortcut: "G S",
      perform: () => window.open("/", "_blank"),
    },
    {
      id: "action-telemetry",
      label: "Inspect Agent Activity Stream",
      category: "Actions",
      icon: Activity,
      shortcut: "G A",
      perform: () => router.push("/dashboard"),
    },
    {
      id: "action-new-product",
      label: "Add New Catalog Product",
      category: "Actions",
      icon: Plus,
      shortcut: "C P",
      perform: () => router.push("/products"),
    },
    {
      id: "system-logout",
      label: "Log Out of Merchant OS",
      category: "System",
      icon: LogOut,
      shortcut: "Q",
      perform: async () => {
        await logoutAction();
      },
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cmd: CommandItem) => {
    setOpen(false);
    setQuery("");
    cmd.perform();
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border shadow-2xl rounded-xl">
        {/* Search Header */}
        <div className="flex items-center border-b px-3.5 py-2.5">
          <Search className="size-4 text-muted-foreground mr-2.5 shrink-0" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInInput}
            placeholder="Type a command or search..."
            className="border-none shadow-none focus-visible:ring-0 text-sm h-9 bg-transparent p-0"
            autoFocus
          />
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.5 text-muted-foreground shrink-0">
            ESC
          </Badge>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No matching merchant commands.</p>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-3.5 shrink-0" />
                    <span>{cmd.label}</span>
                  </div>
                  {cmd.shortcut && (
                    <span
                      className={`font-mono text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground border"
                      }`}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-3.5 py-2 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1">
            <Command className="size-3" />
            <span>Linear Merchant OS</span>
          </div>
          <div className="flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
