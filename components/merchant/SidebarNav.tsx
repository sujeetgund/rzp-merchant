"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  LogOut,
  Zap,
  ShieldCheck,
  Search,
  Command,
  Activity,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(merchant)/actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/agent-activity", label: "Agent Activity", icon: Activity },
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
];

export function SidebarNav() {
  const pathname = usePathname();

  const openCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Zap className="size-4 fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-none tracking-tight text-sidebar-foreground">rzp Merchant</h2>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground tracking-wide">Merchant Control</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Sidebar Content */}
      <SidebarContent className="px-2 py-3 space-y-4">
        {/* Command Palette Trigger Pill */}
        <div className="px-2">
          <button
            onClick={openCommandPalette}
            className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-sidebar-foreground"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5" />
              <span>Search...</span>
            </div>
            <div className="flex items-center gap-0.5 rounded bg-background/20 px-1.5 py-0.5 text-[10px] font-mono border border-border/30">
              <Command className="size-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Management Domain Links */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
            Commerce OS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className={`gap-3 text-xs py-2 transition-all font-medium ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Storefront Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
            Consumer & Agent Surfaces
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Live Storefront"
                  render={<Link href="/" target="_blank" />}
                  className="gap-2.5 border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent py-2 text-xs"
                >
                  <Store className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 font-medium">Live Storefront</span>
                  <span className="flex size-2 rounded-full bg-emerald-500 shadow-2xs" />
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="AI Buyer Demo (V2)"
                  render={<Link href="/ai-buyer" target="_blank" />}
                  className="gap-2.5 border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent py-2 text-xs mt-1"
                >
                  <Bot className="size-3.5 text-primary" />
                  <span className="flex-1 font-medium">AI Buyer Demo (V2)</span>
                  <span className="flex size-2 rounded-full bg-primary shadow-2xs" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar-accent/20">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 p-2.5 border border-sidebar-border shadow-2xs">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-xs shrink-0">
            M
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">Demo Merchant</p>
            <p className="truncate text-[10px] text-muted-foreground">Currency: INR (₹)</p>
          </div>
          <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
        </div>

        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            <span>Log out</span>
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
