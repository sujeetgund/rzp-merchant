"use client";

import { useState } from "react";
import { authClient, signIn, signUp } from "@/lib/auth/auth-client";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Mail, Lock, User, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  title = "Sign In Required",
  description = "Please sign in or create an account to use Shop with AI and place orders.",
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (error) {
          gooeyToast.error(error.message || "Failed to create account");
          setLoading(false);
          return;
        }
        gooeyToast.success("Account created successfully!");
      } else {
        const { error } = await signIn.email({
          email,
          password,
        });
        if (error) {
          gooeyToast.error(error.message || "Invalid email or password");
          setLoading(false);
          return;
        }
        gooeyToast.success("Signed in successfully!");
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch {
      gooeyToast.error("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setLoading(true);
    try {
      const { error } = await authClient.signIn.passkey();
      if (error) {
        gooeyToast.error(error.message || "Passkey sign-in failed.");
      } else {
        gooeyToast.success("Signed in with Passkey!");
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch {
      gooeyToast.error("Passkey sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 h-9 text-xs"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-9 text-xs"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-9 font-semibold text-xs mt-2" disabled={loading}>
            {loading ? "Processing..." : mode === "signup" ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 text-muted-foreground font-mono">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handlePasskeySignIn}
          disabled={loading}
          className="w-full h-9 font-medium text-xs gap-2 border-primary/30"
        >
          <KeyRound className="size-4 text-primary" />
          <span>Passkey (WebAuthn / Touch ID)</span>
        </Button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
