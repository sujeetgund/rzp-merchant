import { getSessionId } from "@/lib/session";
import { getHydratedCart } from "@/lib/cart";
import { CartProvider } from "@/components/storefront/CartContext";
import { AIDrawerProvider } from "@/components/storefront/AIDrawerContext";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { AIDrawer } from "@/components/storefront/AIDrawer";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const sessionId = await getSessionId();
  const initialCart = await getHydratedCart(sessionId);

  return (
    <CartProvider initialCart={initialCart}>
      <AIDrawerProvider>
        <div className="flex min-h-screen flex-col">
          <StoreHeader />
          <main className="flex-1">{children}</main>
        </div>
        <AIDrawer />
      </AIDrawerProvider>
    </CartProvider>
  );
}
