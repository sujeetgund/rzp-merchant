import { redirect } from "next/navigation";
import { isMerchantAuthenticated } from "@/lib/auth/merchant";
import { SidebarNav } from "@/components/merchant/SidebarNav";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const authed = await isMerchantAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full bg-muted/10 text-foreground">
          {/* Official shadcn/ui Sidebar */}
          <SidebarNav />

          {/* Sidebar Inset Content Area */}
          <SidebarInset className="flex-1 flex flex-col min-w-0 min-h-screen">
            <header className="flex h-12 items-center gap-2 border-b bg-background px-4 lg:hidden shrink-0">
              <SidebarTrigger />
              <span className="font-semibold text-sm">rzp Merchant</span>
            </header>
            <main className="mx-auto w-full max-w-7xl px-6 py-6 flex-1">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
