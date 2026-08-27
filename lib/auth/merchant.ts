import crypto from "node:crypto";
import { cookies } from "next/headers";

export const MERCHANT_AUTH_COOKIE = "rzp_merchant_auth";

function expectedToken(): string {
  const secret = process.env.MERCHANT_SESSION_SECRET;
  if (!secret) {
    throw new Error("MERCHANT_SESSION_SECRET is not set. Add it to .env.");
  }
  return crypto.createHmac("sha256", secret).update("merchant-authenticated").digest("hex");
}

export function checkMerchantPassword(password: string): boolean {
  const expected = process.env.MERCHANT_PASSWORD;
  if (!expected) {
    throw new Error("MERCHANT_PASSWORD is not set. Add it to .env.");
  }
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setMerchantAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(MERCHANT_AUTH_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearMerchantAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(MERCHANT_AUTH_COOKIE);
}

export async function isMerchantAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(MERCHANT_AUTH_COOKIE)?.value;
  if (!token) return false;
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
