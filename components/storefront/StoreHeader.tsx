"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Sparkles,
  LogIn,
  LogOut,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/storefront/CartContext";
import { useAIDrawer } from "@/components/storefront/AIDrawerContext";
import { useSession, signOut } from "@/lib/auth/auth-client";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserProfileModal } from "@/components/auth/UserProfileModal";

export function StoreHeader() {
  const { itemCount } = useCart();
  const { open } = useAIDrawer();
  const { data: session } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleShopWithAi = () => {
    if (!session) {
      setAuthModalOpen(true);
    } else {
      open();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            rzp Store
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleShopWithAi}
              className="gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Shop with AI</span>
            </Button>

            <Button
              render={<Link href="/cart" />}
              nativeButton={false}
              variant="outline"
              size="icon"
              className="relative"
            >
              <ShoppingCart className="size-4" />
              {itemCount > 0 && (
                <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1 text-[10px]">
                  {itemCount}
                </Badge>
              )}
            </Button>

            {session?.user ? (
              <div className="flex items-center gap-1.5 pl-2 border-l">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProfileModalOpen(true)}
                  className="text-xs font-medium gap-1.5 h-8 px-2.5 border-primary/20"
                  title="Account Settings"
                >
                  <User className="size-3.5 text-primary" />
                  <span className="max-w-28 truncate">
                    {session.user.name || session.user.email}
                  </span>
                  {session.user.emailVerified ? (
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="size-3 text-amber-500 shrink-0" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="text-xs font-medium gap-1.5 ml-1"
              >
                <LogIn className="size-3.5" />
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => open()}
      />

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
