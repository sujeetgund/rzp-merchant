"use client";

import { useState, useEffect } from "react";
import { authClient, useSession, signOut } from "@/lib/auth/auth-client";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  User,
  LogOut,
  Send,
  Shield,
  Trash2,
  Fingerprint,
  Bot,
  Copy,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BuyerTokenItem {
  id: string;
  name: string;
  token: string;
  maxAmount: number;
  category: string;
  expiresInDays: number;
  humanApprovalThreshold?: number;
  createdAt: string;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "agent">(
    "profile",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [passkeys, setPasskeys] = useState<
    Array<{ id: string; name?: string; createdAt?: string }>
  >([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [passkeyCustomName, setPasskeyCustomName] = useState("");

  // Multi-Token Buyer Agent Delegation State
  const [tokenName, setTokenName] = useState("Procurement Bot #1");
  const [agentMaxAmount, setAgentMaxAmount] = useState("5000");
  const [tokenCategory, setTokenCategory] = useState("All Categories");
  const [tokenExpiryDays, setTokenExpiryDays] = useState("7");
  const [humanApprovalThreshold, setHumanApprovalThreshold] = useState("1000");
  const [buyerTokens, setBuyerTokens] = useState<BuyerTokenItem[]>([]);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

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
      const saved = localStorage.getItem(`rzp_buyer_tokens_${session.user.id}`);
      if (saved) {
        try {
          setBuyerTokens(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
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
      const nameToUse =
        passkeyCustomName.trim() || `${user.name || "User"}'s Passkey`;
      const res = await authClient.passkey.addPasskey({
        name: nameToUse,
      });
      if (res?.error) {
        gooeyToast.error(res.error.message || "Failed to register passkey.");
      } else {
        gooeyToast.success(`Passkey "${nameToUse}" registered successfully!`);
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

  const handleGenerateBuyerKey = () => {
    const amount = Number(agentMaxAmount) || 5000;
    const expiry = Number(tokenExpiryDays) || 7;
    const threshold = Number(humanApprovalThreshold) || 1000;
    const id = `btk_${Date.now()}`;
    const token = `buyer_token_usr_${user.id.slice(0, 6)}_${Date.now()}_m${amount}_e${expiry}d`;

    const newItem: BuyerTokenItem = {
      id,
      name: tokenName.trim() || "AI Buyer Agent",
      token,
      maxAmount: amount,
      category: tokenCategory,
      expiresInDays: expiry,
      humanApprovalThreshold: threshold,
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...buyerTokens];
    setBuyerTokens(updated);
    localStorage.setItem(
      `rzp_buyer_tokens_${user.id}`,
      JSON.stringify(updated),
    );

    gooeyToast.success(`Created "${newItem.name}" delegation token!`);
  };

  const handleRevokeToken = (id: string, name: string) => {
    if (!confirm(`Revoke token "${name}"?`)) return;
    const updated = buyerTokens.filter((t) => t.id !== id);
    setBuyerTokens(updated);
    localStorage.setItem(
      `rzp_buyer_tokens_${user.id}`,
      JSON.stringify(updated),
    );
    gooeyToast.success(`Revoked "${name}".`);
  };

  const handleCopyKey = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    gooeyToast.success("Token copied to clipboard!");
    setTimeout(() => setCopiedTokenId(null), 2000);
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
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-xl p-0 overflow-hidden rounded-2xl flex h-[520px]">
        <DialogTitle className="sr-only">Account Settings</DialogTitle>

        {/* LEFT SIDEBAR */}
        <aside className="w-52 shrink-0 border-r border-border bg-muted/20 p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="px-1">
              <h3 className="font-bold text-sm tracking-tight">
                Account Settings
              </h3>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {user.email}
              </p>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1 text-xs">
              <button
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-xs text-left",
                  activeTab === "profile"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <User className="size-3.5" />
                <span>Profile</span>
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-xs text-left",
                  activeTab === "security"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Shield className="size-3.5" />
                <span>Security & Passkeys</span>
              </button>

              <button
                onClick={() => setActiveTab("agent")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-xs text-left",
                  activeTab === "agent"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Bot className="size-3.5" />
                  <span>AI Agent Keys</span>
                </div>
                {buyerTokens.length > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold">
                    {buyerTokens.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              onClose();
            }}
            className="w-full justify-start text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-8 px-2"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </Button>
        </aside>

        {/* RIGHT CONTENT PANEL */}
        <main className="flex-1 min-w-0 flex flex-col bg-card">
          {/* Header Bar */}
          <div className="p-4 border-b flex items-center justify-between shrink-0 pr-10">
            <h4 className="font-semibold text-sm">
              {activeTab === "profile" && "Profile Information"}
              {activeTab === "security" && "Security & Credentials"}
              {activeTab === "agent" && "AI Buyer Agent Tokens"}
            </h4>
          </div>

          {/* Panel Content Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {activeTab === "profile" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {user.name || "Customer"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border">
                  <div>
                    <p className="text-xs font-semibold">Email Verification</p>
                    <p className="text-[11px] text-muted-foreground">
                      {user.emailVerified
                        ? "Your email is verified."
                        : "Email verification required."}
                    </p>
                  </div>

                  {user.emailVerified ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1 px-2.5 py-0.5"
                    >
                      <CheckCircle2 className="size-3" />
                      <span>Verified</span>
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="h-7 text-xs gap-1 shrink-0"
                    >
                      <Send className="size-3" />
                      <span>
                        {resendLoading ? "Sending..." : "Verify Email"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-4">
                {/* Passkeys Block */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold">Biometric Passkeys</p>
                    <p className="text-[11px] text-muted-foreground">
                      Touch ID & Face ID passkeys registered on this device
                    </p>
                  </div>

                  <div className="flex items-end gap-2 bg-muted/20 p-2.5 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <Label className="text-[10px] font-medium">
                        Device / Hardware Name
                      </Label>
                      <Input
                        type="text"
                        value={passkeyCustomName}
                        onChange={(e) => setPasskeyCustomName(e.target.value)}
                        placeholder="e.g. MacBook Touch ID"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddPasskey}
                      disabled={passkeyLoading}
                      className="h-8 text-xs font-semibold gap-1.5 shrink-0 bg-card"
                    >
                      <KeyRound className="size-3.5 text-primary" />
                      <span>
                        {passkeyLoading ? "Adding..." : "+ Add Passkey"}
                      </span>
                    </Button>
                  </div>

                  {loadingPasskeys ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Loading passkeys...
                    </p>
                  ) : passkeys.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 italic border rounded-lg p-2.5 bg-muted/20">
                      No saved passkeys. Register this device for passwordless
                      sign in.
                    </p>
                  ) : (
                    passkeys.map((pk) => (
                      <div
                        key={pk.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs border"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Fingerprint className="size-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">
                            {pk.name || "Passkey"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            ({pk.id.slice(0, 10)}...)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeletePasskey(pk.id, pk.name)}
                          className="size-6 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Password Form */}
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-3 pt-3 border-t"
                >
                  <p className="text-xs font-semibold">Update Password</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Current Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">New Password</Label>
                      <Input
                        type="password"
                        placeholder="Min 6 chars"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={passwordLoading}
                    className="w-full h-8 text-xs font-semibold"
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === "agent" && (
              <div className="space-y-4">
                {/* Create Token Form */}
                <div className="space-y-2.5 pb-3 border-b">
                  <p className="text-xs font-semibold">
                    Issue Delegation Token
                  </p>
                  <div>
                    <Label className="text-[10px]">Token Name</Label>
                    <Input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g. Work Travel Bot"
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px]">Budget Cap (₹)</Label>
                      <Input
                        type="number"
                        value={agentMaxAmount}
                        onChange={(e) => setAgentMaxAmount(e.target.value)}
                        placeholder="5000"
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Expires In</Label>
                      <select
                        value={tokenExpiryDays}
                        onChange={(e) => setTokenExpiryDays(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs mt-1"
                      >
                        <option value="1">24 Hours</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                        <option value="90">90 Days</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px]">Category Scope</Label>
                      <select
                        value={tokenCategory}
                        onChange={(e) => setTokenCategory(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs mt-1"
                      >
                        <option value="All Categories">All Categories</option>
                        <option value="Footwear">Footwear Only</option>
                        <option value="Apparel">Apparel Only</option>
                        <option value="Fitness & Equipment">
                          Fitness Only
                        </option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">
                        Human Approval Cap (₹)
                      </Label>
                      <Input
                        type="number"
                        value={humanApprovalThreshold}
                        onChange={(e) =>
                          setHumanApprovalThreshold(e.target.value)
                        }
                        placeholder="1000"
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateBuyerKey}
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1 bg-primary text-primary-foreground mt-1"
                  >
                    <KeyRound className="size-3.5" />
                    <span>+ Issue Delegation Token</span>
                  </Button>
                </div>

                {/* Active Tokens */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold">
                    Active Tokens ({buyerTokens.length})
                  </p>
                  {buyerTokens.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 italic text-center border rounded-lg bg-muted/10">
                      No active delegation tokens.
                    </p>
                  ) : (
                    buyerTokens.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border bg-muted/20 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold truncate">
                              {item.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30"
                            >
                              Max ₹{item.maxAmount}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              handleRevokeToken(item.id, item.name)
                            }
                            className="size-5 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>

                        <div className="relative flex items-center rounded border bg-black/90 p-1 font-mono text-[9px] text-emerald-400">
                          <span className="truncate flex-1 pr-6">
                            {item.token}
                          </span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleCopyKey(item.token, item.id)}
                            className="absolute right-0.5 text-white hover:text-emerald-400 size-5"
                          >
                            {copiedTokenId === item.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </DialogContent>
    </Dialog>
  );
}
