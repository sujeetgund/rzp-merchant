"use client";

import { useState, useEffect } from "react";
import { authClient, useSession, signOut } from "@/lib/auth/auth-client";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, KeyRound, Lock, User, LogOut, Send, Shield, Trash2, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name?: string; createdAt?: string }>>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);

  const fetchPasskeys = async () => {
    setLoadingPasskeys(true);
    try {
      const res = await authClient.passkey.listUserPasskeys();
      if (res?.data) {
        setPasskeys(res.data as any[]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    if (isOpen && session?.user) {
      fetchPasskeys();
    }
  }, [isOpen, session]);

  if (!session?.user) return null;
  const { user } = session;

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: window.location.origin,
      });
      if (error) {
        gooeyToast.error(error.message || "Failed to send verification email.");
      } else {
        gooeyToast.success("Verification email sent! Check your inbox.");
      }
    } catch {
      gooeyToast.error("Failed to send verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    setPasskeyLoading(true);
    try {
      const res = await authClient.passkey.addPasskey({
        name: `${user.name || "User"}'s Passkey`,
      });
      if (res?.error) {
        gooeyToast.error(res.error.message || "Failed to register passkey.");
      } else {
        gooeyToast.success("Passkey registered successfully!");
        fetchPasskeys();
      }
    } catch {
      gooeyToast.error("Failed to register passkey.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string, name?: string) => {
    if (!confirm(`Delete passkey "${name || "Passkey"}"?`)) return;
    try {
      const res = await authClient.passkey.deletePasskey({ id });
      if (res?.error) {
        gooeyToast.error(res.error.message || "Failed to delete passkey.");
      } else {
        gooeyToast.success("Passkey removed.");
        fetchPasskeys();
      }
    } catch {
      gooeyToast.error("Failed to delete passkey.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (newPassword.length < 6) {
      gooeyToast.error("New password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        gooeyToast.error(error.message || "Failed to change password.");
      } else {
        gooeyToast.success("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      gooeyToast.error("Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b pr-12">
          <DialogTitle className="text-lg font-bold tracking-tight">Account Settings</DialogTitle>
          {/* Tab Navigation */}
          <div className="flex gap-4 pt-3 text-xs font-medium border-b border-transparent">
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "pb-2 border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "profile"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="size-3.5" />
              <span>Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={cn(
                "pb-2 border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "security"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="size-3.5" />
              <span>Security & Passkeys</span>
            </button>
          </div>
        </DialogHeader>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {activeTab === "profile" && (
            <div className="space-y-4">
              {/* User Avatar + Email Card */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user.name || "Customer"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{user.email}</p>
                </div>
              </div>

              {/* Email Verification Row */}
              <div className="flex items-center justify-between p-3 rounded-xl border">
                <div>
                  <p className="text-xs font-medium">Email Verification</p>
                  <p className="text-[11px] text-muted-foreground">
                    {user.emailVerified ? "Your email address is verified." : "Email verification required."}
                  </p>
                </div>

                {user.emailVerified ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1 px-2.5 py-1">
                    <CheckCircle2 className="size-3.5" />
                    <span>Verified</span>
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="h-8 text-xs gap-1 shrink-0"
                  >
                    <Send className="size-3" />
                    <span>{resendLoading ? "Sending..." : "Verify Email"}</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              {/* Passkeys Block */}
              <div className="p-3.5 rounded-xl border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <KeyRound className="size-3.5 text-primary" />
                      <span>Biometric Passkeys</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Your registered Touch ID / Face ID passkeys
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddPasskey}
                    disabled={passkeyLoading}
                    className="h-8 text-xs font-medium gap-1 shrink-0"
                  >
                    <KeyRound className="size-3 text-primary" />
                    <span>{passkeyLoading ? "Adding..." : "+ Add Passkey"}</span>
                  </Button>
                </div>

                {/* List Saved Passkeys */}
                <div className="space-y-2 pt-1 border-t">
                  {loadingPasskeys ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Loading passkeys...</p>
                  ) : passkeys.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 text-center italic">
                      No saved passkeys yet. Click &quot;+ Add Passkey&quot; to register this device.
                    </p>
                  ) : (
                    passkeys.map((pk) => (
                      <div key={pk.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Fingerprint className="size-4 text-primary shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-xs truncate">{pk.name || "Biometric Passkey"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{pk.id.slice(0, 16)}...</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeletePasskey(pk.id, pk.name)}
                          title="Remove Passkey"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  <span>Update Password</span>
                </h4>

                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px]">Current Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">New Password</Label>
                    <Input
                      type="password"
                      placeholder="Min 6 chars"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <Button type="submit" size="sm" disabled={passwordLoading} className="w-full h-8 text-xs font-semibold">
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t p-3.5 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              onClose();
            }}
            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </Button>

          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs px-4">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
