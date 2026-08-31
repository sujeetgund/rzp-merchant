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
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r bg-background">
      {/* Sidebar Header */}
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Zap className="size-4 fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-none tracking-tight">rzp Merchant</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">Autonomous OS</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Sidebar Content */}
      <SidebarContent className="px-2 py-4 space-y-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
            Management
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
                      className="gap-3 text-sm py-2"
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
            Storefront
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Live Storefront"
                  render={<Link href="/" target="_blank" />}
                  className="gap-2.5 border bg-card text-card-foreground shadow-2xs hover:bg-accent py-2"
                >
                  <Store className="size-4 text-muted-foreground" />
                  <span className="flex-1 font-medium text-xs">Live Storefront</span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer */}
      <SidebarFooter className="border-t p-3 bg-muted/20">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-background p-2.5 border shadow-2xs">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
            M
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold">Demo Merchant</p>
            <p className="truncate text-[10px] text-muted-foreground">currency: INR</p>
          </div>
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
        </div>

        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            <span>Log out</span>
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
