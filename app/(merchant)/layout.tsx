import { redirect } from "next/navigation";
import { isMerchantAuthenticated } from "@/lib/auth/merchant";
import { MerchantNav } from "@/components/merchant/MerchantNav";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const authed = await isMerchantAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <MerchantNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
